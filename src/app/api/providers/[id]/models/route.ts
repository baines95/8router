import { NextResponse } from "next/server";
import { getProviderConnectionById, getProviderConnections } from "@/lib/localDb";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { KiroService } from "@/lib/oauth/services/kiro";
import { GEMINI_CONFIG } from "@/lib/oauth/constants/oauth";
import { refreshGoogleToken, updateProviderCredentials, refreshKiroToken } from "@/sse/services/tokenRefresh";
import { getModelsByProviderId } from "@/shared/constants/models";

const GEMINI_CLI_MODELS_URL = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
const CODEX_REVIEW_SUFFIX = "-review";
const CODEX_REVIEW_QUOTA_FAMILY = "review";

const parseOpenAIStyleModels = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  return data?.data || data?.models || data?.results || [];
};

const parseCodexModels = (data: any): any[] => {
  const models = parseOpenAIStyleModels(data);
  const existingIds = new Set(
    models
      .map((model: any) => model?.id || model?.slug)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
  );

  return models.flatMap((model: any) => {
    const id = model?.id || model?.slug;
    if (!id || typeof id !== "string") return [];

    const name = model?.name || model?.display_name || id;
    const normalized = {
      ...model,
      id,
      name,
    };
    const reviewId = `${id}${CODEX_REVIEW_SUFFIX}`;

    if (id.endsWith(CODEX_REVIEW_SUFFIX) || existingIds.has(reviewId)) {
      return [normalized];
    }

    return [
      normalized,
      {
        ...normalized,
        id: reviewId,
        name: `${name} Review`,
        upstreamModelId: id,
        quotaFamily: CODEX_REVIEW_QUOTA_FAMILY,
      },
    ];
  });
};

const parseGeminiCliModels = (data: any): any[] => {
  if (Array.isArray(data?.models)) {
    return data.models
      .map((item: any) => {
        const id = item?.id || item?.model || item?.name;
        if (!id) return null;
        return { id, name: item?.displayName || item?.name || id };
      })
      .filter(Boolean);
  }

  if (data?.models && typeof data.models === "object") {
    return Object.entries(data.models)
      .filter(([, info]: [string, any]) => !info?.isInternal)
      .map(([id, info]: [string, any]) => ({
        id,
        name: info?.displayName || info?.name || id,
      }));
  }

  return [];
};

const createOpenAIModelsConfig = (url: string) => ({
  url,
  method: "GET",
  headers: { "Content-Type": "application/json" },
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  parseResponse: parseOpenAIStyleModels
});

// Provider models endpoints configuration
const PROVIDER_MODELS_CONFIG: Record<string, any> = {
  claude: {
    url: "https://api.anthropic.com/v1/models",
    method: "GET",
    headers: {
      "Anthropic-Version": "2023-06-01",
      "Content-Type": "application/json"
    },
    authHeader: "x-api-key",
    parseResponse: (data: any) => data.data || []
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authQuery: "key", // Use query param for API key
    parseResponse: (data: any) => data.models || []
  },
  qwen: {
    url: "https://portal.qwen.ai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data: any) => data.data || []
  },
  codex: {
    url: "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: parseCodexModels,
  },
  antigravity: {
    url: "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:models",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    body: {},
    parseResponse: (data: any) => data.models || []
  },
  github: {
    url: "https://api.githubcopilot.com/models",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Copilot-Integration-Id": "vscode-chat",
      "editor-version": "vscode/1.107.1",
      "editor-plugin-version": "copilot-chat/0.26.7",
      "user-agent": "GitHubCopilotChat/0.26.7"
    },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data: any) => {
      if (!data?.data) return [];
      // Filter out embeddings, non-chat models, and disabled models
      return data.data
        .filter((m: any) => m.capabilities?.type === "chat")
        .filter((m: any) => m.policy?.state !== "disabled") // Only return explicitly enabled models
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          version: m.version,
          capabilities: m.capabilities,
          isDefault: m.model_picker_enabled === true
        }));
    }
  },
  openai: createOpenAIModelsConfig("https://api.openai.com/v1/models"),
  openrouter: createOpenAIModelsConfig("https://openrouter.ai/api/v1/models"),
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    method: "GET",
    headers: {
      "Anthropic-Version": "2023-06-01",
      "Content-Type": "application/json"
    },
    authHeader: "x-api-key",
    parseResponse: (data: any) => data.data || []
  },

  alicode: {
    url: "https://coding.dashscope.aliyuncs.com/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data: any) => data.data || []
  },
  "alicode-intl": {
    url: "https://coding-intl.dashscope.aliyuncs.com/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data: any) => data.data || []
  },

  // OpenAI-compatible API key providers
  deepseek: createOpenAIModelsConfig("https://api.deepseek.com/models"),
  groq: createOpenAIModelsConfig("https://api.groq.com/openai/v1/models"),
  xai: createOpenAIModelsConfig("https://api.x.ai/v1/models"),
  mistral: createOpenAIModelsConfig("https://api.mistral.ai/v1/models"),
  perplexity: createOpenAIModelsConfig("https://api.perplexity.ai/models"),
  together: createOpenAIModelsConfig("https://api.together.xyz/v1/models"),
  fireworks: createOpenAIModelsConfig("https://api.fireworks.ai/inference/v1/models"),
  cerebras: createOpenAIModelsConfig("https://api.cerebras.ai/v1/models"),
  cohere: createOpenAIModelsConfig("https://api.cohere.ai/v1/models"),
  nebius: createOpenAIModelsConfig("https://api.studio.nebius.ai/v1/models"),
  siliconflow: createOpenAIModelsConfig("https://api.siliconflow.cn/v1/models"),
  hyperbolic: createOpenAIModelsConfig("https://api.hyperbolic.xyz/v1/models"),
  ollama: createOpenAIModelsConfig("https://ollama.com/api/tags"),
  "ollama-local": createOpenAIModelsConfig("http://localhost:11434/api/tags"),
  nanobanana: createOpenAIModelsConfig("https://api.nanobananaapi.ai/v1/models"),
  chutes: createOpenAIModelsConfig("https://llm.chutes.ai/v1/models"),
  nvidia: createOpenAIModelsConfig("https://integrate.api.nvidia.com/v1/models"),
  assemblyai: createOpenAIModelsConfig("https://api.assemblyai.com/v1/models")
};

type LiveModelsResult = {
  models: any[];
  source: "live" | "fallback";
  warning?: string;
  status?: number;
};

const getConnectionLiveModels = async (connection: any): Promise<LiveModelsResult> => {
  if (isOpenAICompatibleProvider(connection.provider)) {
    const baseUrl = connection.providerSpecificData?.baseUrl;
    if (!baseUrl) {
      return { models: [], source: "fallback", warning: "missing base URL" };
    }

    const url = `${baseUrl.replace(/\/$/, "")}/models`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${connection.apiKey}`,
      },
    });

    if (!response.ok) {
      return { models: [], source: "fallback", warning: `Failed to fetch models: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { models: parseOpenAIStyleModels(data), source: "live" };
  }

  if (isAnthropicCompatibleProvider(connection.provider)) {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": connection.apiKey,
        "anthropic-version": "2023-06-01",
        "Authorization": `Bearer ${connection.apiKey}`
      },
    });

    if (!response.ok) {
      return { models: [], source: "fallback", warning: `Failed to fetch models: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    return { models: data.data || data.models || [], source: "live" };
  }

  if (connection.provider === "kiro") {
    const kiroService: any = new KiroService();
    const profileArn = connection.providerSpecificData?.profileArn;
    const accessToken = connection.accessToken;
    const refreshToken = connection.refreshToken;

    if (accessToken && profileArn) {
      try {
        const models = await kiroService.listAvailableModels(accessToken, profileArn);
        if (models.length > 0) {
          return { models, source: "live" };
        }
      } catch (error) {
        console.log("Failed to fetch Kiro dynamic models:", error);
      }
    }

    if (refreshToken) {
      try {
        const refreshed = await refreshKiroToken(refreshToken, connection.providerSpecificData);
        if (refreshed?.accessToken && profileArn) {
          await updateProviderCredentials(connection.id, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken || refreshToken,
            expiresIn: refreshed.expiresIn,
          });

          const models = await kiroService.listAvailableModels(refreshed.accessToken, profileArn);
          if (models.length > 0) {
            return { models, source: "live" };
          }
        }
      } catch (error) {
        console.log("Failed to refresh Kiro token or fetch models:", error);
      }
    }

    return { models: getModelsByProviderId(connection.provider), source: "fallback", warning: "using static fallback" };
  }

  if (connection.provider === "gemini-cli") {
    const accessToken = connection.accessToken;
    const refreshToken = connection.refreshToken;

    if (!accessToken && !refreshToken) {
      return { models: [], source: "fallback", warning: "missing OAuth credentials", status: 401 };
    }

    const projectId = connection.projectId || connection.providerSpecificData?.projectId;
    const body = projectId ? { project: projectId } : {};

    const fetchModels = async (token: string) => fetch(GEMINI_CLI_MODELS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "code_assist_server/0.1.0",
        "x-goog-api-client": "google-cloud-sdk"
      },
      body: JSON.stringify(body)
    });

    let response;

    try {
      response = await fetchModels(accessToken);

      if (!response.ok && (response.status === 401 || response.status === 403) && refreshToken) {
        const refreshed = await refreshGoogleToken(refreshToken, GEMINI_CONFIG.clientId, GEMINI_CONFIG.clientSecret);
        if (refreshed?.accessToken) {
          await updateProviderCredentials(connection.id, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresIn: refreshed.expiresIn,
          });
          response = await fetchModels(refreshed.accessToken);
        }
      }

      if (response.ok) {
        const data = await response.json();
        const models = parseGeminiCliModels(data);
        if (models.length > 0) {
          return { models, source: "live" };
        }
      }
    } catch (error) {
      console.log("Gemini CLI dynamic model fetch failed:", error);
    }

    return { models: getModelsByProviderId(connection.provider), source: "fallback", warning: "using static fallback" };
  }

  const config = PROVIDER_MODELS_CONFIG[connection.provider as keyof typeof PROVIDER_MODELS_CONFIG];
  if (!config) {
    return { models: getModelsByProviderId(connection.provider), source: "fallback", warning: "using static fallback" };
  }

  const headers: Record<string, string> = { ...config.headers };
  const authToken = connection.accessToken || connection.apiKey;
  if (authToken && config.authHeader) {
    headers[config.authHeader] = `${config.authPrefix || ""}${authToken}`;
  }

  const response = await fetch(config.url, {
    method: config.method,
    headers,
    body: config.body,
  });

  if (!response.ok) {
    return { models: getModelsByProviderId(connection.provider), source: "fallback", warning: `Failed to fetch models: ${response.status}`, status: response.status };
  }

  const data = await response.json();
  const models = config.parseResponse(data);
  if (!models || models.length === 0) {
    return { models: getModelsByProviderId(connection.provider), source: "fallback", warning: "using static fallback" };
  }

  return { models, source: "live" };
};

/**
 * GET /api/providers/[id]/models - Get models list from provider
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const directConnection = await getProviderConnectionById(id);
    if (directConnection) {
      const { models, source, warning } = await getConnectionLiveModels(directConnection);
      if (models.length > 0) {
        return NextResponse.json({
          provider: directConnection.provider,
          connectionId: directConnection.id,
          models,
          source,
          ...(warning ? { warning } : {})
        });
      }

      const fallbackModels = getModelsByProviderId(directConnection.provider);
      return NextResponse.json({
        provider: directConnection.provider,
        connectionId: directConnection.id,
        models: fallbackModels,
        source: "fallback",
        ...(warning ? { warning } : {})
      });
    }

    const providerConnections: any[] = (await getProviderConnections({ provider: id, isActive: true })) || [];

    if (providerConnections.length === 0) {
      return NextResponse.json({
        provider: id,
        models: getModelsByProviderId(id),
        source: "fallback",
        fallbackReason: "no active connections",
        connectionCount: 0,
        liveSuccessCount: 0
      });
    }

    if (providerConnections.length > 0) {
      const staticModels = getModelsByProviderId(id);
      const modelsById = new Map<string, any>();
      const warnings: string[] = [];
      let liveSuccessCount = 0;

      const settledResults = await Promise.allSettled(
        providerConnections.map((connection) => getConnectionLiveModels(connection))
      );

      settledResults.forEach((result, index) => {
        const connection = providerConnections[index];

        if (result.status === "fulfilled") {
          const { models, source, warning } = result.value;

          if (source === "live" && models.length > 0) {
            liveSuccessCount += 1;
            for (const model of models) {
              if (model?.id && !modelsById.has(model.id)) {
                modelsById.set(model.id, model);
              }
            }
          }

          if (warning) {
            warnings.push(`${connection.id}: ${warning}`);
          }

          return;
        }

        console.log(`Error fetching models from connection ${connection.id}:`, result.reason);
        warnings.push(`${connection.id}: fetch failed`);
      });

      if (modelsById.size > 0) {
        return NextResponse.json({
          provider: id,
          models: Array.from(modelsById.values()),
          source: "live",
          connectionCount: providerConnections.length,
          liveSuccessCount,
          ...(warnings.length > 0 ? { warnings } : {})
        });
      }

      if (staticModels.length > 0) {
        return NextResponse.json({
          provider: id,
          models: staticModels,
          source: "fallback",
          fallbackReason: "all live fetches failed",
          connectionCount: providerConnections.length,
          liveSuccessCount,
          ...(warnings.length > 0 ? { warnings } : {})
        });
      }
    }

    return NextResponse.json({ error: "Provider connection not found" }, { status: 404 });
  } catch (error) {
    console.log("Error fetching provider models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
