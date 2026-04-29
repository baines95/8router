"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CircleNotchIcon,
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  CheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Modal, Button, Input } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

interface DeviceData {
  verification_uri_complete?: string;
  verification_uri?: string;
  user_code: string;
  device_code: string;
  interval: number;
}

interface AuthData {
  authUrl: string;
  redirectUri: string;
  codeVerifier?: string;
}

interface OAuthModalProps {
  open: boolean;
  provider: string;
  providerInfo: { name: string };
  onSuccess?: () => void;
  onClose: () => void;
  oauthMeta?: any;
  idcConfig?: {
    startUrl?: string;
    region?: string;
  };
}

/**
 * OAuth Modal Component
 * - Localhost: Auto callback via popup message
 * - Remote: Manual paste callback URL
 */
export default function OAuthModal({ open, provider, providerInfo, onSuccess, onClose, oauthMeta }: OAuthModalProps) {
  const [step, setStep] = useState<"waiting" | "input" | "success" | "error">("waiting");
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeviceCode, setIsDeviceCode] = useState(false);
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollingAbortRef = useRef(false);
  const { copied, copy } = useCopyToClipboard();

  // State for client-only values to avoid hydration mismatch
  const [placeholderUrl, setPlaceholderUrl] = useState("/callback?code=...");
  const callbackProcessedRef = useRef(false);

  // Detect client origin for callback placeholder
  useEffect(() => {
    if (typeof window !== "undefined") {
      void (async () => { setPlaceholderUrl(`${window.location.origin}/callback?code=...`); })();
    }
  }, []);

  // Exchange tokens
  const exchangeTokens = useCallback(async (code: string, state: string | null) => {
    if (!authData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/oauth/${provider}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: authData.redirectUri,
          codeVerifier: authData.codeVerifier,
          state,
          ...(oauthMeta ? { meta: oauthMeta } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, [authData, provider, onSuccess, oauthMeta]);

  // Poll for device code token
  const startPolling = useCallback(async (deviceCode: string, codeVerifier: string | undefined, interval: number, extraData?: any) => {
    pollingAbortRef.current = false;
    setPolling(true);
    const maxAttempts = 60;

    for (let i = 0; i < maxAttempts; i++) {
      if (pollingAbortRef.current) {
        setPolling(false);
        return;
      }

      await new Promise((r) => setTimeout(r, interval * 1000));

      if (pollingAbortRef.current) {
        setPolling(false);
        return;
      }

      try {
        const res = await fetch(`/api/oauth/${provider}/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode, codeVerifier, extraData }),
        });

        const data = await res.json();

        if (data.success) {
          pollingAbortRef.current = true;
          setStep("success");
          setPolling(false);
          onSuccess?.();
          return;
        }

        if (data.error === "expired_token" || data.error === "access_denied") {
          throw new Error(data.errorDescription || data.error);
        }

        if (data.error === "slow_down") {
          interval = Math.min(interval + 5, 30);
        }
      } catch (err: any) {
        setError(err.message);
        setStep("error");
        setPolling(false);
        return;
      }
    }

    setError("Authorization timeout");
    setStep("error");
    setPolling(false);
  }, [provider, onSuccess]);

  // Start OAuth flow
  const startOAuthFlow = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    try {
      setError(null);

      const deviceCodeProviders = ["github", "qwen", "kiro", "kimi-coding", "kilocode", "codebuddy"];
      if (deviceCodeProviders.includes(provider)) {
        setIsDeviceCode(true);
        setStep("waiting");

        const redirectUri = `${window.location.origin}/callback`;
        const authorizePayload = provider === "openai"
          ? {}
          : { ...(oauthMeta ? { meta: oauthMeta } : {}) };
        const res = await fetch(`/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authorizePayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setDeviceData(data);
        startPolling(data.device_code, data.codeVerifier, data.interval || 5, data.extraData);
        return;
      }

      setIsDeviceCode(false);
      setStep("waiting");

      const appPort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
      let redirectUri = `${window.location.origin}/callback`;
      if (provider === "codex") {
        try {
          const proxyRes = await fetch(`/api/oauth/codex/start-proxy?app_port=${appPort}`);
          const proxyData = await proxyRes.json();
          if (proxyData?.success) {
            redirectUri = "http://localhost:1455/auth/callback";
          }
        } catch {
          redirectUri = `${window.location.origin}/callback`;
        }
      }

      const res = await fetch(`/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAuthData({ ...data, redirectUri });
      callbackProcessedRef.current = false;

      if (provider === "openai") {
        const parsed = new URL(data.authUrl);
        const originator = parsed.searchParams.get("originator");
        const hasCodexFlag = parsed.searchParams.has("codex_cli_simplified_flow");
        if (originator !== "openai_native" || hasCodexFlag) {
          throw new Error("Invalid OpenAI auth URL contract");
        }
      }

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      popupRef.current = window.open(
        data.authUrl,
        "oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, [provider, oauthMeta, startPolling]);

  useEffect(() => {
    if (open) {
      void (async () => { startOAuthFlow(); })();
    } else {
      // Cleanup
      if (popupRef.current) popupRef.current.close();
      pollingAbortRef.current = true;
    }
  }, [open, startOAuthFlow]);

  // Listen for callback
  useEffect(() => {
    const handleCallback = (data: any) => {
      if (callbackProcessedRef.current) return;
      
      const { code, state, error: errorParam, errorDescription } = data;
      
      if (errorParam) {
        setError(errorDescription || errorParam);
        setStep("error");
        callbackProcessedRef.current = true;
        return;
      }

      if (code) {
        callbackProcessedRef.current = true;
        exchangeTokens(code, state);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const isLocalhostEvent = event.origin.includes("localhost") || event.origin.includes("127.0.0.1");
      const isSameOrigin = event.origin === window.location.origin;
      if (!isLocalhostEvent && !isSameOrigin) return;
      if (event.data?.type === "oauth_callback") {
        handleCallback(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("oauth_callback");
      channel.onmessage = (event) => handleCallback(event.data);
    } catch (e) {
      console.log("BroadcastChannel not supported");
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "oauth_callback" && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          handleCallback(data);
          localStorage.removeItem("oauth_callback");
        } catch (e) {
          console.log("Failed to parse localStorage data");
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (channel) channel.close();
    };
  }, [authData, exchangeTokens]);

  const handleManualSubmit = async () => {
    try {
      setError(null);
      const url = new URL(callbackUrl);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");
      if (errorParam) throw new Error(url.searchParams.get("error_description") || errorParam);
      if (!code) throw new Error("No authorization code found in URL");
      await exchangeTokens(code, state);
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    }
  };

  const handleClose = useCallback(() => {
    if (provider === "codex") {
      fetch("/api/oauth/codex/stop-proxy").catch(() => {});
    }
    onClose();
  }, [onClose, provider]);

  if (!provider || !providerInfo) return null;
  const deviceLoginUrl = deviceData?.verification_uri_complete || deviceData?.verification_uri || "";

  return (
    <Modal open={open} title={`Connect ${providerInfo.name}`} onClose={handleClose}>
      <div className="flex flex-col gap-4">
        {step === "waiting" && !isDeviceCode && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <CircleNotchIcon className="size-8 text-primary animate-spin" weight="bold" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Waiting for Authorization</h3>
            <p className="text-sm text-muted-foreground mb-4 font-medium italic">
              Complete the authorization in the popup window.
            </p>
            <Button variant="ghost" onClick={() => setStep("input")} className="w-full h-10 font-bold text-xs uppercase tracking-widest border border-border/50 bg-muted/5">
              Popup blocked? Enter URL manually
            </Button>
          </div>
        )}

        {step === "waiting" && isDeviceCode && deviceData && (
          <>
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Visit the login URL below and authorize:
              </p>
              <div className="bg-muted/30 p-4 mb-4 border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 opacity-60">Login URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm break-all font-mono opacity-80">{deviceLoginUrl}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copy(deviceLoginUrl, "login_url")}
                    disabled={!deviceLoginUrl}
                    className="size-8"
                  >
                    {copied === "login_url" ? <CheckIcon className="size-4" weight="bold" /> : <CopyIcon className="size-4" weight="bold" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(deviceLoginUrl, "_blank", "noopener,noreferrer")}
                    disabled={!deviceLoginUrl}
                    className="size-8"
                  >
                    <ArrowSquareOutIcon className="size-4" weight="bold" />
                  </Button>
                </div>
              </div>
              <div className="bg-primary/10 p-4 border border-primary/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Authorization Code</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-2xl font-mono font-bold text-primary tracking-wider tabular-nums">{deviceData.user_code}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copy(deviceData.user_code, "user_code")}
                    className="size-8 text-primary hover:bg-primary/20"
                  >
                    {copied === "user_code" ? <CheckIcon className="size-4" weight="bold" /> : <CopyIcon className="size-4" weight="bold" />}
                  </Button>
                </div>
              </div>
            </div>
            {polling && (
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                <CircleNotchIcon className="size-3.5 animate-spin" weight="bold" />
                Awaiting downstream validation...
              </div>
            )}
          </>
        )}

        {step === "input" && !isDeviceCode && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 opacity-60">Step 1: Open challenge URL</p>
              <div className="flex gap-2">
                <Input value={authData?.authUrl || ""} readOnly className="flex-1 font-mono text-xs h-9 bg-muted/5 border-border/50 opacity-60" />
                <Button variant="outline" onClick={() => copy(authData?.authUrl || "", "auth_url")} className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest border-border/50 bg-background">
                   {copied === "auth_url" ? <CheckIcon className="size-3.5 mr-1.5" weight="bold" /> : <CopyIcon className="size-3.5 mr-1.5" weight="bold" />}
                   Copy
                </Button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 opacity-60">Step 2: Submit callback URL</p>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium italic">
                After authorization, copy the full URL from your browser address bar.
              </p>
              <Input
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder={placeholderUrl}
                className="font-mono text-xs h-9 bg-muted/5 border-border/50"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleManualSubmit} className="flex-1 h-10 font-bold text-[10px] uppercase tracking-widest shadow-none" disabled={!callbackUrl || loading} loading={loading}>
                Connect Node
              </Button>
              <Button onClick={handleClose} variant="outline" className="flex-1 h-10 font-bold text-[10px] uppercase tracking-widest border-border/50 bg-background">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CheckCircleIcon className="size-8 text-primary" weight="bold" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground uppercase">Linked Successfully</h3>
            <p className="text-xs text-muted-foreground mb-6 font-medium italic opacity-60">
              The {providerInfo.name} infrastructure node is now active.
            </p>
            <Button onClick={handleClose} className="w-full h-11 font-bold text-[10px] uppercase tracking-widest shadow-none">
              Finish Provisioning
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 bg-destructive/5 border border-destructive/20 flex items-center justify-center">
              <WarningCircleIcon className="size-8 text-destructive" weight="bold" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground uppercase">Connection Failed</h3>
            <p className="text-[10px] font-bold uppercase tracking-wide text-destructive mb-8 px-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={startOAuthFlow} variant="secondary" className="flex-1 h-10 font-bold text-[10px] uppercase tracking-widest bg-muted/20 border border-border/50" loading={loading}>
                Retry Challenge
              </Button>
              <Button onClick={handleClose} variant="outline" className="flex-1 h-10 font-bold text-[10px] uppercase tracking-widest border border-border/50 bg-background">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
