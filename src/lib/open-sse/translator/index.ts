import { FORMATS } from "./formats";
import { ensureToolCallIds, fixMissingToolResponses } from "./helpers/toolCallHelper";
import { prepareClaudeRequest } from "./helpers/claudeHelper";
import { cloakClaudeTools } from "../utils/claudeCloaking";
import { filterToOpenAIFormat } from "./helpers/openaiHelper";
import { normalizeThinkingConfig } from "../services/provider";
import { cloakTools as cloakAntigravityTools } from "../utils/antigravityHelper";
import { applyRtkFailOpen } from "../rtk";
import "./request/claude-to-openai";
import "./request/openai-to-claude";
import "./request/gemini-to-openai";
import "./request/openai-to-gemini";
import "./request/openai-to-vertex";
import "./request/antigravity-to-openai";
import "./request/openai-responses";
import "./request/openai-to-kiro";
import "./request/openai-to-cursor";
import "./request/openai-to-ollama";
import "./response/claude-to-openai";
import "./response/openai-to-claude";
import "./response/gemini-to-openai";
import "./response/openai-to-antigravity";
import "./response/openai-responses";
import "./response/kiro-to-openai";
import "./response/cursor-to-openai";
import "./response/ollama-to-openai";

type TranslatorRegistryStore = {
  requestRegistry: Map<string, Function>;
  responseRegistry: Map<string, Function>;
};

function getRegistryStore(): TranslatorRegistryStore {
  const globalKey = "__openSseTranslatorRegistryStore";
  const globalObject = globalThis as typeof globalThis & {
    __openSseTranslatorRegistryStore?: TranslatorRegistryStore;
  };

  if (!globalObject[globalKey]) {
    globalObject[globalKey] = {
      requestRegistry: new Map<string, Function>(),
      responseRegistry: new Map<string, Function>(),
    };
  }

  return globalObject[globalKey]!;
}

export function register(from: string, to: string, requestFn?: Function | null, responseFn?: Function | null): void {
  const key = `${from}:${to}`;
  const { requestRegistry, responseRegistry } = getRegistryStore();

  if (requestFn) {
    requestRegistry.set(key, requestFn);
  }
  if (responseFn) {
    responseRegistry.set(key, responseFn);
  }
}

function ensureInitialized(): void {
  getRegistryStore();
}

function stripContentTypes(body: any, stripList: string[] = []): void {
  if (!stripList.length || !body.messages || !Array.isArray(body.messages)) return;
  const imageTypes = new Set(["image_url", "image"]);
  const audioTypes = new Set(["audio_url", "input_audio"]);
  const shouldStrip = (type: string) => {
    if (imageTypes.has(type)) return stripList.includes("image");
    if (audioTypes.has(type)) return stripList.includes("audio");
    return false;
  };
  for (const msg of body.messages) {
    if (!Array.isArray(msg.content)) continue;
    msg.content = msg.content.filter((part: any) => !shouldStrip(part.type));
    if (msg.content.length === 0) msg.content = "";
  }
}

export function translateRequest(
  sourceFormat: string,
  targetFormat: string,
  model: string,
  body: any,
  stream: boolean = true,
  credentials: any = null,
  provider: string | null = null,
  reqLogger: any = null,
  stripList: string[] = [],
  connectionId: string | null | undefined = null
): any {
  if (sourceFormat !== targetFormat) {
    ensureInitialized();
  }

  const { requestRegistry } = getRegistryStore();

  let result = body;
  result = applyRtkFailOpen(result);

  stripContentTypes(result, stripList);
  normalizeThinkingConfig(result);
  ensureToolCallIds(result);
  fixMissingToolResponses(result);

  if (sourceFormat !== targetFormat) {
    if (sourceFormat !== FORMATS.OPENAI) {
      const toOpenAI = requestRegistry.get(`${sourceFormat}:${FORMATS.OPENAI}`);
      if (toOpenAI) {
        result = toOpenAI(model, result, stream, credentials);
        reqLogger?.logOpenAIRequest?.(result);
      }
    }

    if (targetFormat !== FORMATS.OPENAI) {
      const fromOpenAI = requestRegistry.get(`${FORMATS.OPENAI}:${targetFormat}`);
      if (fromOpenAI) {
        result = fromOpenAI(model, result, stream, credentials);
      }
    }
  }

  if (targetFormat === FORMATS.OPENAI) {
    result = filterToOpenAIFormat(result);
  }

  if (targetFormat === FORMATS.CLAUDE) {
    const apiKey = credentials?.accessToken || credentials?.apiKey || null;
    result = prepareClaudeRequest(result, provider, apiKey, connectionId);
  }

  if (provider === "claude") {
    const apiKey = credentials?.accessToken || credentials?.apiKey || null;
    if (apiKey?.includes("sk-ant-oat")) {
      const { body: cloakedBody, toolNameMap } = cloakClaudeTools(result);
      result = cloakedBody;
      if (toolNameMap && toolNameMap.size > 0) {
        result._toolNameMap = toolNameMap;
      }
    }
  }

  if (provider === FORMATS.ANTIGRAVITY && body.userAgent !== FORMATS.ANTIGRAVITY) {
    const { cloakedBody, toolNameMap } = cloakAntigravityTools(result);
    result = cloakedBody;
    if (toolNameMap && toolNameMap.size > 0) {
      result._toolNameMap = toolNameMap;
    }
  }

  return result;
}

export function translateResponse(targetFormat: string, sourceFormat: string, chunk: any, state: any): any[] {
  ensureInitialized();
  if (sourceFormat === targetFormat) {
    return [chunk];
  }

  const { responseRegistry } = getRegistryStore();
  let results: any[] = [chunk];
  let openaiResults: any[] | null = null;

  if (targetFormat !== FORMATS.OPENAI) {
    const toOpenAI = responseRegistry.get(`${targetFormat}:${FORMATS.OPENAI}`);
    if (toOpenAI) {
      results = [];
      const converted = toOpenAI(chunk, state);
      if (converted) {
        results = Array.isArray(converted) ? converted : [converted];
        openaiResults = results;
      }
    }
  }

  if (sourceFormat !== FORMATS.OPENAI) {
    const fromOpenAI = responseRegistry.get(`${FORMATS.OPENAI}:${sourceFormat}`);
    if (fromOpenAI) {
      const finalResults: any[] = [];
      for (const r of results) {
        const converted = fromOpenAI(r, state);
        if (converted) {
          finalResults.push(...(Array.isArray(converted) ? converted : [converted]));
        }
      }
      results = finalResults;
    }
  }

  if (openaiResults && sourceFormat !== FORMATS.OPENAI && targetFormat !== FORMATS.OPENAI) {
    (results as any)._openaiIntermediate = openaiResults;
  }

  return results;
}

export function needsTranslation(sourceFormat: string, targetFormat: string): boolean {
  return sourceFormat !== targetFormat;
}

export function initState(sourceFormat: string): any {
  const base: any = {
    messageId: null,
    model: null,
    textBlockStarted: false,
    thinkingBlockStarted: false,
    inThinkingBlock: false,
    currentBlockIndex: null,
    toolCalls: new Map(),
    finishReason: null,
    finishReasonSent: false,
    usage: null,
    contentBlockIndex: -1
  };

  if (sourceFormat === FORMATS.OPENAI_RESPONSES) {
    return {
      ...base,
      seq: 0,
      responseId: `resp_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      started: false,
      msgTextBuf: {},
      msgItemAdded: {},
      msgContentAdded: {},
      msgItemDone: {},
      reasoningId: "",
      reasoningIndex: -1,
      reasoningBuf: "",
      reasoningPartAdded: false,
      reasoningDone: false,
      inThinking: false,
      funcArgsBuf: {},
      funcNames: {},
      funcCallIds: {},
      funcArgsDone: {},
      funcItemDone: {},
      completedSent: false
    };
  }

  return base;
}

export function initTranslators(): void {
  ensureInitialized();
}
