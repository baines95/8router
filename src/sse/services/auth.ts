import { getProviderConnections, getProviderConnectionById, validateApiKey, updateProviderConnection, getSettings, type ProviderConnection } from "@/lib/localDb";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { formatRetryAfter, checkFallbackError, isModelLockActive, buildModelLockUpdate, getEarliestModelLockUntil } from "@/lib/open-sse/services/accountFallback";
import { BACKOFF_CONFIG } from "@/lib/open-sse/config/errorConfig";
import { resolveProviderId, FREE_PROVIDERS } from "@/shared/constants/providers";
import { getQuotaSnapshotState, type QuotaSnapshot } from "@/lib/usage/quotaSnapshot";
import * as log from "../utils/logger";

// Mutex to prevent race conditions during account selection
let selectionMutex = Promise.resolve();

// Runtime selector memory (per provider+model) to avoid premature account flips
const fillFirstPreferredConnectionByContext = new Map<string, string>();
const roundRobinLastConnectionByContext = new Map<string, string>();
const SELECTOR_CONTEXT_MEMORY_CAP = 512;

// Deduplicate repetitive clear-account logs under concurrent success traffic
const clearLogDedupeByContext = new Map<string, number>();
const CLEAR_LOG_DEDUPE_WINDOW_MS = 15000;

function formatAccountRef(connection: Pick<ProviderConnection, "id" | "displayName" | "name" | "email"> | null | undefined): string {
  if (!connection?.id) return "unknown";
  const label = connection.displayName || connection.name || connection.email || connection.id.slice(0, 8);
  return `${label} (${connection.id.slice(0, 8)})`;
}

function formatCooldownUntil(iso: string | null): string {
  return iso || "n/a";
}

function formatShortCooldownUntil(iso: string | null): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(11, 19);
}

function formatAuthCtx(providerId: string, model: string | null, mode: string): string {
  return `provider=${providerId} model=${model || "__all"} mode=${mode}`;
}

function createRequestTag(): string {
  return Math.random().toString(36).slice(2, 6);
}

function getAuthEventIcon(event: string): string {
  switch (event) {
    case "SCAN":
      return "🧭";
    case "SKIP":
      return "⏭️";
    case "SELECT":
      return "✅";
    case "LOCK":
      return "🔒";
    case "CLEAR":
      return "🧹";
    case "EXHAUSTED":
      return "⛔";
    default:
      return "•";
  }
}

function formatSkippedConnections(
  items: Array<{ connection: ProviderConnection; reason: string; cooldownUntil: string | null }>,
  maxItems: number = 6,
): string {
  if (items.length === 0) return "";
  const visibleItems = items.slice(0, maxItems).map((item) => (
    `${formatAccountRef(item.connection)}:${item.reason}@${formatShortCooldownUntil(item.cooldownUntil)}`
  ));
  const hiddenCount = items.length - visibleItems.length;
  if (hiddenCount > 0) {
    visibleItems.push(`... +${hiddenCount} more`);
  }
  return `[${visibleItems.join(", ")}]`;
}

function formatAuthEvent(requestTag: string, event: string, message: string): string {
  return `${getAuthEventIcon(event)} [r=${requestTag}] ${event} ${message}`;
}

function formatModelLabel(model: string | null): string {
  return model || "__all";
}

function getAuthRequestTag(excludeSet: Set<string>): string {
  const state = excludeSet as Set<string> & { __authRequestTag?: string };
  if (!state.__authRequestTag) {
    state.__authRequestTag = createRequestTag();
  }
  return state.__authRequestTag;
}

function formatErrorDetail(errorText: string): string {
  return errorText.length > 100 ? errorText.slice(0, 100) : errorText;
}

function getAutoPauseState(connection: ProviderConnection | null | undefined): { autoPausedUntil: string | null; autoPauseReason: string | null } {
  const providerSpecificData = connection?.providerSpecificData || {};
  return {
    autoPausedUntil: typeof providerSpecificData.autoPausedUntil === "string" ? providerSpecificData.autoPausedUntil : null,
    autoPauseReason: typeof providerSpecificData.autoPauseReason === "string" ? providerSpecificData.autoPauseReason : null,
  };
}

function isProviderAutoPauseEnabled(settings: any, providerId: string): boolean {
  return settings?.providerStrategies?.[providerId]?.autoPauseByQuota === true;
}

function shouldAutoResumeConnection(connection: ProviderConnection | null | undefined, now: number, autoPauseEnabled: boolean): boolean {
  if (!autoPauseEnabled || !connection || connection.isActive !== false) return false;
  const { autoPausedUntil, autoPauseReason } = getAutoPauseState(connection);
  if (autoPauseReason !== "quota" || !autoPausedUntil) return false;
  const pausedUntilMs = Date.parse(autoPausedUntil);
  return !Number.isNaN(pausedUntilMs) && pausedUntilMs <= now;
}

function getQuotaResetAtMs(quota: any): number | null {
  const resetAt = quota?.resetAt;
  if (typeof resetAt !== "string" || !resetAt) return null;
  const resetAtMs = Date.parse(resetAt);
  return Number.isNaN(resetAtMs) ? null : resetAtMs;
}

function isQuotaExhausted(quota: any): boolean {
  if (!quota || typeof quota !== "object") return false;
  const total = typeof quota.total === "number" ? quota.total : 0;
  const used = typeof quota.used === "number" ? quota.used : 0;
  if (total <= 0) return false;
  return used >= total;
}

function getEarliestQuotaResetAt(quotas: any[] | undefined, now: number): string | null {
  if (!Array.isArray(quotas)) return null;
  const futureResetTimes = quotas
    .filter(isQuotaExhausted)
    .map(getQuotaResetAtMs)
    .filter((value): value is number => value !== null && value > now)
    .sort((a, b) => a - b);

  return futureResetTimes.length > 0 ? new Date(futureResetTimes[0]).toISOString() : null;
}

export async function reconcileConnectionQuotaPause(
  connection: Pick<ProviderConnection, "id" | "provider" | "isActive" | "providerSpecificData">,
  input: { autoPauseByQuota: boolean; quotas?: any[]; quotaSnapshot?: QuotaSnapshot | null },
  now: number = Date.now(),
): Promise<{ action: "disabled" | "enabled" | "none"; autoPausedUntil: string | null }> {
  if (!input.autoPauseByQuota) {
    return { action: "none", autoPausedUntil: null };
  }

  const providerSpecificData = connection.providerSpecificData || {};
  const snapshotState = input.quotaSnapshot
    ? getQuotaSnapshotState(input.quotaSnapshot, now)
    : null;
  const earliestResetAt = snapshotState
    ? (snapshotState.exhausted ? snapshotState.nextResetAt : null)
    : getEarliestQuotaResetAt(input.quotas, now);

  if (earliestResetAt && connection.isActive !== false) {
    await updateProviderConnection(connection.id, {
      isActive: false,
      providerSpecificData: {
        ...providerSpecificData,
        autoPausedUntil: earliestResetAt,
        autoPauseReason: "quota",
      },
    } as any);
    return { action: "disabled", autoPausedUntil: earliestResetAt };
  }

  if (!earliestResetAt && shouldAutoResumeConnection(connection as ProviderConnection, now, true)) {
    await updateProviderConnection(connection.id, {
      isActive: true,
      providerSpecificData: {
        ...providerSpecificData,
        autoPausedUntil: null,
        autoPauseReason: null,
      },
    } as any);
    return { action: "enabled", autoPausedUntil: null };
  }

  return { action: "none", autoPausedUntil: null };
}

async function autoResumePausedConnections(providerId: string, settings: any): Promise<void> {
  const now = Date.now();
  const autoPauseEnabled = isProviderAutoPauseEnabled(settings, providerId);
  const allConnections = await getProviderConnections({ provider: providerId });
  const resumableConnections = allConnections.filter(connection => shouldAutoResumeConnection(connection, now, autoPauseEnabled));

  await Promise.all(resumableConnections.map(connection => {
    const providerSpecificData = {
      ...(connection.providerSpecificData || {}),
      autoPausedUntil: null,
      autoPauseReason: null,
    };
    return updateProviderConnection(connection.id, {
      isActive: true,
      providerSpecificData,
    } as any);
  }));
}

function shouldEmitClearLog(contextKey: string): boolean {
  const now = Date.now();
  const last = clearLogDedupeByContext.get(contextKey) || 0;
  if (now - last < CLEAR_LOG_DEDUPE_WINDOW_MS) return false;
  clearLogDedupeByContext.set(contextKey, now);
  while (clearLogDedupeByContext.size > SELECTOR_CONTEXT_MEMORY_CAP) {
    const oldestKey = clearLogDedupeByContext.keys().next().value;
    if (!oldestKey) break;
    clearLogDedupeByContext.delete(oldestKey);
  }
  return true;
}

function getSelectionContextKey(providerId: string, model: string | null): string {
  return `${providerId}::${model || "__all"}`;
}

function setSelectorMemory(map: Map<string, string>, key: string, value: string): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);

  while (map.size > SELECTOR_CONTEXT_MEMORY_CAP) {
    const oldestKey = map.keys().next().value;
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

export interface ProviderCredentials {
  id?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  projectId?: string;
  connectionName: string;
  copilotToken?: string;
  providerSpecificData?: any;
  connectionId?: string;
  testStatus?: string;
  lastError?: string;
  _connection?: ProviderConnection;
  isActive?: boolean;
  allRateLimited?: boolean;
  retryAfter?: string | null;
  retryAfterHuman?: string;
  lastErrorCode?: string | number | null;
}

/**
 * Get provider credentials from localDb
 * Filters out unavailable accounts and returns the selected account based on strategy
 * @param {string} provider - Provider name
 * @param {Set<string>|string|null} excludeConnectionIds - Connection ID(s) to exclude (for retry with next account)
 * @param {string|null} model - Model name for per-model rate limit filtering
 */
export async function getProviderCredentials(provider: string, excludeConnectionIds: Set<string> | string | null = null, model: string | null = null): Promise<ProviderCredentials | null> {
  // Normalize to Set for consistent handling
  const excludeSet = excludeConnectionIds instanceof Set
    ? excludeConnectionIds
    : (excludeConnectionIds ? new Set([excludeConnectionIds]) : new Set<string>());
  // Acquire mutex to prevent race conditions
  const currentMutex = selectionMutex;
  let resolveMutex!: () => void;
  selectionMutex = new Promise(resolve => { resolveMutex = resolve as any; });

  try {
    await currentMutex;

    // Resolve alias to provider ID (e.g., "kc" -> "kilocode")
    const providerId = resolveProviderId(provider);

    // Inject a virtual connection for no-auth free providers
    if ((FREE_PROVIDERS as any)[providerId]?.noAuth) {
      return { id: "noauth", connectionName: "Public", isActive: true, accessToken: "public" };
    }

    const settings = await getSettings();
    await autoResumePausedConnections(providerId, settings);
    const connections = await getProviderConnections({ provider: providerId, isActive: true });

    if (connections.length === 0) {
      log.warn("AUTH", `[AUTH] ${formatAuthCtx(providerId, model, "n/a")} no-account-configured`);
      return null;
    }

    // Per-provider strategy overrides global setting
    const providerOverride = (settings.providerStrategies || {})[providerId] || {};
    const strategy = providerOverride.fallbackStrategy || settings.comboStrategy || "fill-first";
    const authCtx = formatAuthCtx(providerId, model, strategy);
    const requestTag = getAuthRequestTag(excludeSet);

    const skippedConnections = connections
      .map(c => {
        const excluded = excludeSet.has(c.id);
        const locked = isModelLockActive(c, model);
        if (!excluded && !locked) return null;
        const cooldownUntil = locked ? getEarliestModelLockUntil(c) : null;
        const reason = excluded && locked ? "excluded+model-locked" : (excluded ? "excluded" : "model-locked");
        return { connection: c, reason, cooldownUntil };
      })
      .filter(Boolean) as Array<{ connection: ProviderConnection; reason: string; cooldownUntil: string | null }>;

    // Filter out model-locked and excluded connections
    const availableConnections = connections.filter(c => {
      if (excludeSet.has(c.id)) return false;
      if (isModelLockActive(c, model)) return false;
      return true;
    });

    log.info("AUTH", formatAuthEvent(requestTag, "SCAN", `${authCtx} accounts=${connections.length} usable=${availableConnections.length} skipped=${skippedConnections.length}`));
    if (skippedConnections.length > 0) {
      log.debug("AUTH", formatAuthEvent(requestTag, "SKIP", `count=${skippedConnections.length} ${formatSkippedConnections(skippedConnections)}`));
    }

    if (availableConnections.length === 0) {
      // Find earliest lock expiry across all connections for retry timing
      const lockedConns = connections.filter(c => isModelLockActive(c, model));
      const expiries = lockedConns.map(c => getEarliestModelLockUntil(c)).filter(Boolean) as string[];
      const earliest = expiries.sort()[0] || null;
      if (earliest) {
        const earliestConn = lockedConns[0];
        log.warn("AUTH", formatAuthEvent(requestTag, "EXHAUSTED", `reason=model-locked retryAfter=${formatRetryAfter(earliest)} cooldownUntil=${earliest} sampleAccount=${formatAccountRef(earliestConn)}`));
        return {
          connectionName: "",
          allRateLimited: true,
          retryAfter: earliest,
          retryAfterHuman: formatRetryAfter(earliest),
          lastError: earliestConn?.lastError || undefined,
          lastErrorCode: earliestConn?.errorCode || undefined
        };
      }
      log.warn("AUTH", formatAuthEvent(requestTag, "EXHAUSTED", `reason=excluded-or-inactive`));
      return null;
    }

    const contextKey = getSelectionContextKey(providerId, model);
    let connection: any;
    let selectedReason = "first-available";
    if (strategy === "round-robin") {
      const lastSelectedId = roundRobinLastConnectionByContext.get(contextKey);

      if (!lastSelectedId) {
        connection = availableConnections[0];
        selectedReason = "round-robin-first";
      } else {
        const currentIdx = availableConnections.findIndex(c => c.id === lastSelectedId);
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % availableConnections.length : 0;
        // Hard round-robin: every request advances to next usable account.
        // Accounts on cooldown/unusable are already filtered out in availableConnections.
        connection = availableConnections[nextIdx];
        selectedReason = currentIdx >= 0 ? `round-robin-next-from-${lastSelectedId.slice(0, 8)}` : "round-robin-reset";
      }

      if (connection?.id) setSelectorMemory(roundRobinLastConnectionByContext, contextKey, connection.id);
    } else {
      // Mode 1 (fill-first): stick to last healthy selected account to avoid premature jump-back
      const preferredId = fillFirstPreferredConnectionByContext.get(contextKey);
      const preferred = preferredId ? availableConnections.find(c => c.id === preferredId) : null;
      connection = preferred || availableConnections[0];
      selectedReason = preferred ? `fill-first-stick-${preferredId?.slice(0, 8)}` : "fill-first-first-available";
      if (connection?.id) setSelectorMemory(fillFirstPreferredConnectionByContext, contextKey, connection.id);
    }

    log.info("AUTH", formatAuthEvent(requestTag, "SELECT", `account=${formatAccountRef(connection)} reason=${selectedReason}`));

    const resolvedProxy = await resolveConnectionProxyConfig(connection.providerSpecificData || {});

    return {
      apiKey: connection.apiKey,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      projectId: connection.projectId,
      connectionName: connection.displayName || connection.name || connection.email || connection.id,
      copilotToken: connection.providerSpecificData?.copilotToken,
      providerSpecificData: {
        ...(connection.providerSpecificData || {}),
        connectionProxyEnabled: resolvedProxy.connectionProxyEnabled,
        connectionProxyUrl: resolvedProxy.connectionProxyUrl,
        connectionNoProxy: resolvedProxy.connectionNoProxy,
        connectionProxyPoolId: resolvedProxy.proxyPoolId || null,
        vercelRelayUrl: resolvedProxy.vercelRelayUrl || "",
      },
      connectionId: connection.id,
      // Include current status for optimization check
      testStatus: connection.testStatus,
      lastError: connection.lastError,
      // Pass full connection for clearAccountError to read modelLock_* keys
      _connection: connection
    };
  } finally {
    if (resolveMutex) resolveMutex();
  }
}

/**
 * Mark account+model as unavailable — locks modelLock_${model} in DB.
 * All errors (429, 401, 5xx, etc.) lock per model, not per account.
 */
export async function markAccountUnavailable(
  connectionId: string,
  status: number,
  errorText: string,
  provider: string | null = null,
  model: string | null = null,
  resetsAtMs: number | null = null
) {
  if (!connectionId || connectionId === "noauth") return { shouldFallback: false, cooldownMs: 0 };
  const connections = await getProviderConnections({ provider: provider || undefined });
  const conn = connections.find(c => c.id === connectionId);
  const backoffLevel = (conn as any)?.backoffLevel || 0;

  const { shouldFallback, cooldownMs, newBackoffLevel } = checkFallbackError(status, errorText, backoffLevel);
  if (!shouldFallback) return { shouldFallback: false, cooldownMs: 0 };

  let effectiveCooldownMs = cooldownMs;
  let cooldownSource = "backoff";
  if (typeof resetsAtMs === "number" && Number.isFinite(resetsAtMs) && resetsAtMs > Date.now()) {
    const resetCooldownMs = Math.max(0, Math.floor(resetsAtMs - Date.now()));
    effectiveCooldownMs = Math.min(resetCooldownMs, BACKOFF_CONFIG.max);
    cooldownSource = "retry-after";
  }

  const reason = typeof errorText === "string" ? errorText.slice(0, 100) : "Provider error";
  const lockUpdate = buildModelLockUpdate(model, effectiveCooldownMs);
  const lockKey = Object.keys(lockUpdate)[0];
  const cooldownUntil = (lockUpdate as any)[lockKey] || null;

  const providerId = resolveProviderId(provider || conn?.provider || "unknown");
  const settings = await getSettings();
  const autoPause = isProviderAutoPauseEnabled(settings, providerId) && cooldownSource === "retry-after";
  const nextProviderSpecificData = autoPause
    ? {
        ...(conn?.providerSpecificData || {}),
        autoPausedUntil: cooldownUntil,
        autoPauseReason: "quota",
      }
    : undefined;

  await updateProviderConnection(connectionId, {
    ...lockUpdate,
    testStatus: "unavailable",
    lastError: reason,
    errorCode: String(status),
    lastErrorAt: new Date().toISOString(),
    backoffLevel: newBackoffLevel ?? backoffLevel,
    ...(autoPause ? { isActive: false, providerSpecificData: nextProviderSpecificData } : {}),
  } as any);

  const providerOverride = (settings.providerStrategies || {})[providerId] || {};
  const authMode = providerOverride.fallbackStrategy || settings.comboStrategy || "fill-first";
  const requestTag = createRequestTag();
  log.warn("AUTH", formatAuthEvent(requestTag, "LOCK", `provider=${providerId} model=${formatModelLabel(model)} mode=${authMode} account=${formatAccountRef(conn)} status=${status} lockKey=${lockKey} cooldownSource=${cooldownSource} cooldownUntil=${formatCooldownUntil(cooldownUntil)} backoffLevel=${newBackoffLevel ?? backoffLevel} detail=${formatErrorDetail(reason)}`));

  if (provider && status && reason) {
    console.error(`❌ ${provider} [${status}]: ${reason}`);
  }

  return { shouldFallback: true, cooldownMs: effectiveCooldownMs };
}

/**
 * Clear account error status on successful request.
 */
export async function clearAccountError(connectionId: string, currentConnection: any, model: string | null = null) {
  if (!connectionId || connectionId === "noauth") return;
  const snapshotConn = currentConnection._connection || currentConnection;
  const conn = await getProviderConnectionById(connectionId) || snapshotConn;
  const now = Date.now();
  const allLockKeys = Object.keys(conn).filter(k => k.startsWith("modelLock_"));

  if (!conn.testStatus && !conn.lastError && allLockKeys.length === 0) return;

  // Keys to clear: expired locks only
  const keysToClear = allLockKeys.filter(k => {
    const expiry = (conn as any)[k];
    return expiry && new Date(expiry).getTime() <= now;
  });

  if (keysToClear.length === 0 && conn.testStatus !== "unavailable" && !conn.lastError) return;

  // Check if any active locks remain after clearing
  const remainingActiveLocks = allLockKeys.filter(k => {
    if (keysToClear.includes(k)) return false;
    const expiry = (conn as any)[k];
    return expiry && new Date(expiry).getTime() > now;
  });

  const clearObj: Record<string, any> = Object.fromEntries(keysToClear.map(k => [k, null]));

  // Only reset error state if no active locks remain
  if (remainingActiveLocks.length === 0) {
    Object.assign(clearObj, { testStatus: "active", lastError: null, lastErrorAt: null, backoffLevel: 0 });
  }

  if (Object.keys(clearObj).length === 0) return;

  await updateProviderConnection(connectionId, clearObj);
  const providerId = resolveProviderId(conn?.provider || snapshotConn?.provider || currentConnection?.provider || "unknown");
  const settings = await getSettings();
  const providerOverride = (settings.providerStrategies || {})[providerId] || {};
  const authMode = providerOverride.fallbackStrategy || settings.comboStrategy || "fill-first";
  const contextKey = `${connectionId}::${model || "__all"}`;
  if (shouldEmitClearLog(contextKey)) {
    const requestTag = createRequestTag();
    const clearedKeys = keysToClear.join(",") || "none";
    log.info("AUTH", formatAuthEvent(requestTag, "CLEAR", `provider=${providerId} model=${formatModelLabel(model)} mode=${authMode} account=${formatAccountRef(conn)} cleared=${keysToClear.length} clearedKeys=${clearedKeys} remainingActiveLocks=${remainingActiveLocks.length}`));
  }
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check Anthropic x-api-key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey) {
    return xApiKey;
  }

  return null;
}

/**
 * Validate API key (optional - for local use can skip)
 */
export async function isValidApiKey(apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false;
  return (await validateApiKey(apiKey)) === true;
}
