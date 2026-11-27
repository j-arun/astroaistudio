import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { buildAnalyzePromptParts } from './src/data/promptBuilder.ts';
import { buildGrahaTimelineExtractionPrompt } from './src/data/timelinePromptBuilder.ts';

dotenv.config();

const PORT = Number(process.env.PORT || process.env.ASTRO_PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.astro-studio-data');
const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const THREADS_FILE = path.join(DATA_DIR, 'threads.json');
const API_CONFIG_FILE = path.join(DATA_DIR, 'api-config.json');

interface PersistedConfig {
  baseApiUrl: string;
  natalEndpointPath: string;
  transitEndpointPath: string;
  apiBearerToken: string;
  llmProvider: 'gemini' | 'fable' | 'ollama';
  geminiModel: string;
  fableEndpointUrl: string;
  fableModel: string;
  fableApiKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

const DEFAULT_CONFIG: PersistedConfig = {
  baseApiUrl: '',
  natalEndpointPath: '/api/natal/dump',
  transitEndpointPath: '/api/transit/dump',
  apiBearerToken: '',
  llmProvider: 'gemini',
  geminiModel: 'gemini-4-hydrogen',
  fableEndpointUrl: '',
  fableModel: '',
  fableApiKey: '',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:latest',
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

type LlmRequestType = 'submit-card' | 'astro-reasoning' | 'follow-up-chat' | 'test-adapter';

interface LlmLogContext {
  filePath: string;
  fileName: string;
  record: {
    requestId: string;
    date: string;
    timestamp: string;
    localTimestamp: string;
    requestType: LlmRequestType;
    route: string;
    provider: 'gemini' | 'fable' | 'ollama';
    model: string;
    endpointUrl?: string;
    status:
      | 'pending'
      | 'received'
      | 'parsed'
      | 'fallback_plain_text'
      | 'parse_error'
      | 'upstream_error';
    query: unknown;
    httpStatus?: number;
    stopReason?: string;
    usage?: unknown;
    rawHttpBody?: string;
    extractedText?: string;
    parsedOutput?: unknown;
    error?: string;
    completedAt?: string;
  };
}

function formatQueryForLog(query: unknown): string {
  if (typeof query === 'string') return query;
  if (!query || typeof query !== 'object') return String(query ?? '');
  const q = query as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      parts.push(`--- ${k} ---\n${v}`);
    } else {
      parts.push(`--- ${k} ---\n${JSON.stringify(v, null, 2)}`);
    }
  }
  return parts.join('\n\n');
}

function flushLlmLog(ctx: LlmLogContext): void {
  try {
    ensureLogsDir();
    const r = ctx.record;
    const lines: string[] = [
      '================================================================================',
      `REQUEST ID   : ${r.requestId}`,
      `DATE         : ${r.date}`,
      `TIMESTAMP    : ${r.timestamp}`,
      `LOCAL TIME   : ${r.localTimestamp}`,
      `TYPE         : ${r.requestType}`,
      `ROUTE        : ${r.route}`,
      `PROVIDER     : ${r.provider}`,
      `MODEL        : ${r.model}`,
      ...(r.endpointUrl ? [`ENDPOINT     : ${r.endpointUrl}`] : []),
      `STATUS       : ${r.status}`,
      ...(r.httpStatus !== undefined ? [`HTTP STATUS  : ${r.httpStatus}`] : []),
      ...(r.stopReason ? [`STOP REASON  : ${r.stopReason}`] : []),
      ...(r.usage !== undefined ? [`USAGE        : ${JSON.stringify(r.usage)}`] : []),
      ...(r.completedAt ? [`COMPLETED AT : ${r.completedAt}`] : []),
      '================================================================================',
      '',
      '[QUERY]',
      formatQueryForLog(r.query),
      '',
      '[RAW RESPONSE FROM UNDERLYING SYSTEM (WRITTEN VERBATIM BEFORE PARSING)]',
      r.rawHttpBody !== undefined ? r.rawHttpBody : '(not received yet)',
      '',
    ];

    if (r.extractedText !== undefined && r.extractedText !== r.rawHttpBody) {
      lines.push('[EXTRACTED TEXT]', r.extractedText, '');
    }

    if (r.error) {
      lines.push('[ERROR / NOTICE]', r.error, '');
    }

    if (r.parsedOutput !== undefined) {
      lines.push('[PARSED OUTPUT]', JSON.stringify(r.parsedOutput, null, 2), '');
    }

    fs.writeFileSync(ctx.filePath, lines.join('\n'), 'utf-8');
  } catch (err) {
    console.error(`[LLM Log] Failed to write ${ctx.filePath}:`, err);
  }
}

function createLlmLog(params: {
  requestType: LlmRequestType;
  route: string;
  provider: 'gemini' | 'fable' | 'ollama';
  model: string;
  endpointUrl?: string;
  query: unknown;
}): LlmLogContext {
  ensureLogsDir();
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
  const rand = Math.random().toString(36).slice(2, 6);
  const fileName = `${dateStr}_${timeStr}_${params.requestType}_${params.provider}_${rand}.log`;
  const filePath = path.join(LOGS_DIR, fileName);

  const ctx: LlmLogContext = {
    filePath,
    fileName,
    record: {
      requestId: `${dateStr}_${timeStr}_${rand}`,
      date: dateStr,
      timestamp: now.toISOString(),
      localTimestamp: now.toString(),
      requestType: params.requestType,
      route: params.route,
      provider: params.provider,
      model: params.model,
      endpointUrl: params.endpointUrl,
      status: 'pending',
      query: params.query,
    },
  };
  flushLlmLog(ctx);
  return ctx;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractPlainTextFromResponse(contentType: string, rawBody: string): string {
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(rawBody);
      if (typeof parsed === 'string') return parsed;
      const candidate =
        parsed.natalDump ??
        parsed.transitDump ??
        parsed.plainText ??
        parsed.text ??
        parsed.dump ??
        parsed.data ??
        parsed.result;
      if (typeof candidate === 'string') return candidate;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return rawBody;
    }
  }
  return rawBody;
}

function resolveFableApiKey(cfg: PersistedConfig): string {
  const candidates = [
    cfg.fableApiKey,
    process.env.ANTHROPIC_API_KEY,
    process.env.FABLE_API_KEY,
    process.env.CLAUDE_API_KEY,
    cfg.apiBearerToken,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const stripped = candidate.trim().replace(/^Bearer\s+/i, '').trim();
      const firstToken = stripped.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)[0];
      if (firstToken) {
        return firstToken.replace(/^Bearer\s+/i, '').trim();
      }
    }
  }
  return '';
}

function extractTextFromSseStream(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  const dataLines = lines.filter((l) => l.startsWith('data:'));
  if (dataLines.length === 0) return null;

  let combined = '';
  for (const line of dataLines) {
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const evt = JSON.parse(payload);
      const piece =
        evt?.choices?.[0]?.delta?.content ??
        evt?.choices?.[0]?.message?.content ??
        evt?.delta?.text ??
        evt?.content_block?.text ??
        evt?.text ??
        '';
      if (typeof piece === 'string') {
        combined += piece;
      }
    } catch {
      // ignore non-JSON SSE keepalive/event lines
    }
  }
  return combined.trim() ? combined : null;
}

function extractTextFromAdapterPayload(raw: string): {
  text: string;
  stopReason?: string;
  usage?: unknown;
} {
  const sseText = extractTextFromSseStream(raw);
  if (sseText !== null) {
    return { text: sseText };
  }

  try {
    const parsed = JSON.parse(raw);

    // Extract stop/finish reason and token usage when present
    const stopReason =
      parsed?.stop_reason ??
      parsed?.choices?.[0]?.finish_reason ??
      parsed?.finish_reason ??
      undefined;
    const usage = parsed?.usage ?? undefined;

    // If the endpoint already returned our astro JSON directly without an envelope
    if (
      parsed &&
      typeof parsed === 'object' &&
      (('overallSynthesis' in parsed && 'cardReadings' in parsed) ||
        ('factors' in parsed && 'planets' in parsed))
    ) {
      return { text: JSON.stringify(parsed), stopReason, usage };
    }

    // Anthropic /v1/messages format
    if (Array.isArray(parsed?.content)) {
      const anthropicText = parsed.content
        .filter(
          (block: Record<string, unknown>) =>
            block && block.type === 'text' && typeof block.text === 'string'
        )
        .map((block: Record<string, unknown>) => block.text as string)
        .join('\n')
        .trim();
      if (anthropicText) return { text: anthropicText, stopReason, usage };
    }

    // OpenAI /chat/completions array-content format
    const choiceContent = parsed?.choices?.[0]?.message?.content;
    if (Array.isArray(choiceContent)) {
      const joined = choiceContent
        .map((part: Record<string, unknown>) =>
          typeof part?.text === 'string'
            ? part.text
            : typeof part?.content === 'string'
            ? part.content
            : ''
        )
        .filter(Boolean)
        .join('\n')
        .trim();
      if (joined) return { text: joined, stopReason, usage };
    }

    // OpenAI Responses API output array
    if (Array.isArray(parsed?.output)) {
      const outputTexts: string[] = [];
      for (const item of parsed.output as Array<Record<string, unknown>>) {
        if (Array.isArray(item?.content)) {
          for (const part of item.content as Array<Record<string, unknown>>) {
            if (typeof part?.text === 'string') outputTexts.push(part.text);
          }
        } else if (typeof item?.text === 'string') {
          outputTexts.push(item.text);
        }
      }
      const joined = outputTexts.join('\n').trim();
      if (joined) return { text: joined, stopReason, usage };
    }

    const content =
      (typeof choiceContent === 'string' ? choiceContent : undefined) ??
      parsed?.choices?.[0]?.text ??
      parsed?.output_text ??
      parsed?.reply ??
      parsed?.response ??
      parsed?.answer ??
      parsed?.result ??
      parsed?.text ??
      (typeof parsed?.content === 'string' ? parsed.content : undefined) ??
      (typeof parsed?.data?.content === 'string' ? parsed.data.content : undefined) ??
      (typeof parsed?.data?.text === 'string' ? parsed.data.text : undefined);

    if (typeof content === 'string') return { text: content, stopReason, usage };
    return { text: raw, stopReason, usage };
  } catch {
    return { text: raw };
  }
}

async function callFableAdapter(
  cfg: PersistedConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  expectJson: boolean,
  logCtx?: LlmLogContext
): Promise<string> {
  if (!cfg.fableEndpointUrl || !cfg.fableEndpointUrl.trim()) {
    throw new Error(
      'Fable LLM Adapter endpoint URL is not configured. Open Settings -> LLM Adapters to enter your Fable endpoint.'
    );
  }

  const endpointUrl = cfg.fableEndpointUrl.trim();
  const rawKey = resolveFableApiKey(cfg);
  if (!rawKey) {
    throw new Error(
      'Fable API key is missing. Enter your key in Settings -> LLM Adapters (Fable API Key) or set ANTHROPIC_API_KEY / FABLE_API_KEY in Secrets.'
    );
  }

  const modelTrimmed = (cfg.fableModel || '').trim();
  const isExplicitOpenAi =
    /\/chat\/completions\b/i.test(endpointUrl) ||
    /\/completions\b/i.test(endpointUrl) ||
    /\/responses\b/i.test(endpointUrl) ||
    /openai\.com/i.test(endpointUrl);

  const isAnthropicEndpoint =
    !isExplicitOpenAi &&
    (/\/v1\/messages\b/i.test(endpointUrl) ||
      /anthropic\.com/i.test(endpointUrl) ||
      /^claude/i.test(modelTrimmed));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Append a strict JSON reminder to the final user message when JSON is expected
  const effectiveMessages = expectJson
    ? messages.map((m, idx) =>
        idx === messages.length - 1 && m.role === 'user'
          ? {
              ...m,
              content: `${m.content}\n\nIMPORTANT: Output ONLY a single valid JSON object starting with { and ending with }. Do not include markdown fences or explanatory prose outside the JSON.`,
            }
          : m
      )
    : messages;

  let bodyPayload: Record<string, unknown>;

  if (isAnthropicEndpoint) {
    headers['x-api-key'] = rawKey;
    headers['anthropic-version'] = '2023-06-01';

    const systemText = effectiveMessages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
      .trim();

    const conversationMessages = effectiveMessages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    bodyPayload = {
      model: modelTrimmed || 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages:
        conversationMessages.length > 0
          ? conversationMessages
          : [{ role: 'user', content: systemText || 'Hello' }],
    };
    if (systemText) {
      bodyPayload.system = systemText;
    }
  } else {
    headers['x-api-key'] = rawKey;
    headers['Authorization'] = `Bearer ${rawKey}`;
    bodyPayload = {
      messages: effectiveMessages,
    };
    if (modelTrimmed) {
      bodyPayload.model = modelTrimmed;
    }
    if (expectJson) {
      bodyPayload.response_format = { type: 'json_object' };
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Network error';
    const errMsg = `Cannot reach Fable Adapter at ${endpointUrl} (${detail}).`;
    if (logCtx) {
      logCtx.record.status = 'upstream_error';
      logCtx.record.error = errMsg;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);
    }
    throw new Error(errMsg);
  }

  let raw = await upstream.text();

  // Some OpenAI-compatible gateways reject response_format with HTTP 400 before running the model.
  // Retry once without response_format only when rejected on 400 with response_format error.
  if (
    !upstream.ok &&
    upstream.status === 400 &&
    !isAnthropicEndpoint &&
    expectJson &&
    'response_format' in bodyPayload &&
    /response_format/i.test(raw)
  ) {
    delete bodyPayload.response_format;
    upstream = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });
    raw = await upstream.text();
  }

  // CRITICAL: Write raw HTTP response verbatim to disk IMMEDIATELY before any extraction or parsing
  if (logCtx) {
    logCtx.record.httpStatus = upstream.status;
    logCtx.record.rawHttpBody = raw;
    logCtx.record.status = upstream.ok ? 'received' : 'upstream_error';
    flushLlmLog(logCtx);
  }

  const extracted = extractTextFromAdapterPayload(raw);
  if (logCtx) {
    logCtx.record.extractedText = extracted.text;
    logCtx.record.stopReason = extracted.stopReason;
    logCtx.record.usage = extracted.usage;
    flushLlmLog(logCtx);
  }

  if (!upstream.ok) {
    const errMsg = `Fable Adapter returned ${upstream.status}: ${raw.slice(0, 260)}`;
    if (logCtx) {
      logCtx.record.error = errMsg;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);
    }
    throw new Error(errMsg);
  }

  return extracted.text;
}

function normalizeOllamaBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
  return trimmed.replace(/\/api\/(chat|generate|tags)$/i, '');
}

async function callOllamaAdapter(
  cfg: PersistedConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  expectJson: boolean,
  logCtx?: LlmLogContext
): Promise<string> {
  const baseUrl = normalizeOllamaBaseUrl(cfg.ollamaBaseUrl || 'http://localhost:11434');
  const model = (cfg.ollamaModel || '').trim();
  if (!model) {
    throw new Error(
      'Ollama model name is not configured. Open Settings -> LLM Adapters to enter or discover your Ollama model (e.g., qwen2.5:14b).'
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid Ollama Base URL: ${baseUrl}`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Ollama Base URL must use http:// or https://.');
  }

  const chatUrl = `${baseUrl}/api/chat`;
  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };
  if (expectJson) {
    bodyPayload.format = 'json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Connection refused';
    throw new Error(
      `Cannot reach Private LLM (Ollama) at ${baseUrl} (${detail}). Ensure Ollama is running locally or use a reachable tunnel URL if this app is running remotely.`
    );
  }

  const raw = await upstream.text();

  let extractedText = raw;
  try {
    const parsed = JSON.parse(raw);
    const content = parsed?.message?.content ?? parsed?.response;
    if (typeof content === 'string') extractedText = content;
  } catch {
    // keep raw
  }

  if (logCtx) {
    logCtx.record.httpStatus = upstream.status;
    logCtx.record.rawHttpBody = raw;
    logCtx.record.extractedText = extractedText;
    logCtx.record.status = upstream.ok ? 'received' : 'upstream_error';
    flushLlmLog(logCtx);
  }

  if (!upstream.ok) {
    const errMsg = `Ollama returned ${upstream.status}: ${raw.slice(0, 260)}`;
    if (logCtx) {
      logCtx.record.error = errMsg;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);
    }
    throw new Error(errMsg);
  }

  return extractedText;
}

function repairJsonText(input: string): string {
  // 1. Escape unescaped control characters (newlines, tabs, etc.) inside double-quoted JSON strings
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        const code = ch.charCodeAt(0);
        if (code < 0x20) {
          out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
          out += ch;
        }
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
    }
  }

  // 2. Remove trailing commas before } or ] outside strings
  out = out.replace(/,\s*([}\]])/g, '$1');
  return out;
}

function extractBalancedJsonObjects(text: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let j = i;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
          } else if (ch === '{') {
            depth++;
          } else if (ch === '}') {
            depth--;
            if (depth === 0) {
              results.push(text.slice(i, j + 1));
              i = j;
              break;
            }
          }
        }
      }
    }
    i++;
  }
  return results;
}

function tryParseJsonCandidate(candidate: string): Record<string, unknown> | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  for (const attempt of [trimmed, repairJsonText(trimmed)]) {
    try {
      const val = JSON.parse(attempt);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return val as Record<string, unknown>;
      }
    } catch {
      // continue to next attempt
    }
  }
  return null;
}

function parseLooseJson(rawText: string): Record<string, unknown> {
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 1. Direct parse
  const direct = tryParseJsonCandidate(withoutThink);
  if (direct) return direct;

  // 2. Extract any fenced code blocks (```json ... ``` or ``` ... ```) anywhere in the text
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(withoutThink)) !== null) {
    const parsedFence = tryParseJsonCandidate(match[1]);
    if (parsedFence) return parsedFence;
  }

  // 3. Extract balanced { ... } objects across the response (prefer larger/valid objects)
  const balancedObjects = extractBalancedJsonObjects(withoutThink).sort(
    (a, b) => b.length - a.length
  );
  for (const objStr of balancedObjects) {
    const parsedObj = tryParseJsonCandidate(objStr);
    if (parsedObj) return parsedObj;
  }

  // 4. Fallback slice from first { to last } with repair
  const firstBrace = withoutThink.indexOf('{');
  const lastBrace = withoutThink.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const parsedSlice = tryParseJsonCandidate(withoutThink.slice(firstBrace, lastBrace + 1));
    if (parsedSlice) return parsedSlice;
  }

  throw new Error('Model response was not valid JSON.');
}

function buildPlainTextFallbackReading(
  rawText: string,
  cards: Array<{ id: string }>,
  logFileName: string
): Record<string, unknown> {
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const leadSummary =
    paragraphs[0]?.slice(0, 600) ||
    cleaned.slice(0, 600) ||
    'Response received in plain text format.';

  return {
    overallSynthesis: leadSummary,
    cardReadings: cards.map((c) => ({
      cardId: c.id,
      verdictSummary: leadSummary,
      planetaryTriggers: `${cleaned}\n\n[Saved raw response to logs/${logFileName}]`,
      timingWindow: 'See full reading details',
      guidance:
        paragraphs.length > 1
          ? paragraphs[paragraphs.length - 1].slice(0, 500)
          : 'Review the saved response in the Astrological Reasoning panel or logs folder.',
    })),
    _rawFallbackNotice: `Model returned plain text instead of strict JSON. Full raw response was saved to logs/${logFileName} and rendered below.`,
    _logFile: logFileName,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/profiles', (_req, res) => {
    const profiles = readJsonFile(PROFILES_FILE, null);
    res.json({ profiles });
  });

  app.post('/api/profiles', (req, res) => {
    const { profiles } = req.body;
    if (!Array.isArray(profiles)) {
      res.status(400).json({ error: 'Invalid profiles payload.' });
      return;
    }
    writeJsonFile(PROFILES_FILE, profiles);
    res.json({ ok: true });
  });

  app.get('/api/threads', (_req, res) => {
    const threads = readJsonFile(THREADS_FILE, []);
    res.json({ threads });
  });

  app.post('/api/threads', (req, res) => {
    const { threads } = req.body;
    if (!Array.isArray(threads)) {
      res.status(400).json({ error: 'Invalid threads payload.' });
      return;
    }
    writeJsonFile(THREADS_FILE, threads);
    res.json({ ok: true });
  });

  app.get('/api/config', (_req, res) => {
    const stored = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    res.json({ config: { ...DEFAULT_CONFIG, ...stored } });
  });

  app.post('/api/config', (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Invalid config payload.' });
      return;
    }
    const merged = { ...DEFAULT_CONFIG, ...config };
    writeJsonFile(API_CONFIG_FILE, merged);
    res.json({ ok: true });
  });

  // Server-side Proxy to Fetch Plain-Text Natal or Transit Dump via REST Query
  app.post('/api/external/fetch-dump', async (req, res) => {
    const { url, method = 'GET', bearerToken, queryParams, payload } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Please provide a valid API Base URL or endpoint URL.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.status(400).json({ error: `Malformed URL: ${url}` });
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'Only http:// and https:// URLs are supported.' });
      return;
    }
    if (parsedUrl.hostname === '169.254.169.254') {
      res.status(403).json({ error: 'Blocked metadata endpoint.' });
      return;
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'text/plain, application/json',
      };
      if (bearerToken && typeof bearerToken === 'string' && bearerToken.trim()) {
        headers['Authorization'] = bearerToken.startsWith('Bearer ')
          ? bearerToken.trim()
          : `Bearer ${bearerToken.trim()}`;
      }

      const upperMethod = String(method).toUpperCase() === 'POST' ? 'POST' : 'GET';

      if (queryParams && typeof queryParams === 'object') {
        for (const [k, v] of Object.entries(queryParams)) {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            parsedUrl.searchParams.set(k, String(v));
          }
        }
      }

      const fetchInit: RequestInit = { method: upperMethod, headers };
      if (upperMethod === 'POST') {
        headers['Content-Type'] = 'application/json';
        fetchInit.body = JSON.stringify(payload || {});
      }

      const resolvedUrl = parsedUrl.toString();
      const upstream = await fetch(resolvedUrl, fetchInit);
      const rawBody = await upstream.text();
      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: `Upstream ${resolvedUrl} returned ${upstream.status}: ${rawBody.slice(0, 240)}`,
        });
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const text = extractPlainTextFromResponse(contentType, rawBody);
      res.json({ text, resolvedUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to call external API.';
      res.status(502).json({ error: message });
    }
  });

  // Discover installed models on Private Ollama instance
  app.post('/api/astro/ollama-models', async (req, res) => {
    const { ollamaBaseUrl } = req.body || {};
    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const baseUrl = normalizeOllamaBaseUrl(
      typeof ollamaBaseUrl === 'string' && ollamaBaseUrl.trim()
        ? ollamaBaseUrl
        : storedCfg.ollamaBaseUrl || DEFAULT_CONFIG.ollamaBaseUrl
    );

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      res.status(400).json({ error: `Invalid Ollama Base URL: ${baseUrl}` });
      return;
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'Only http:// and https:// URLs are supported.' });
      return;
    }

    try {
      const upstream = await fetch(`${baseUrl}/api/tags`);
      const raw = await upstream.text();
      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: `Ollama /api/tags returned ${upstream.status}: ${raw.slice(0, 200)}`,
        });
        return;
      }
      const data = JSON.parse(raw);
      const models: string[] = Array.isArray(data.models)
        ? data.models
            .map((m: { name?: string; model?: string }) => m.name || m.model || '')
            .filter(Boolean)
        : [];
      res.json({ models, baseUrl });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Unable to reach Ollama.';
      res.status(502).json({
        error: `Cannot reach Ollama at ${baseUrl} (${detail}). Ensure Ollama is running or accessible from this server.`,
      });
    }
  });

  // Live Adapter Connection Test (Gemini, Fable & Private Ollama)
  app.post('/api/astro/test-adapter', async (req, res) => {
    const {
      provider,
      geminiModel,
      fableEndpointUrl,
      fableModel,
      fableApiKey,
      ollamaBaseUrl,
      ollamaModel,
    } = req.body || {};

    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const activeCfg: PersistedConfig = {
      ...DEFAULT_CONFIG,
      ...storedCfg,
      geminiModel:
        typeof geminiModel === 'string' && geminiModel.trim()
          ? geminiModel.trim()
          : storedCfg.geminiModel || DEFAULT_CONFIG.geminiModel,
      fableEndpointUrl:
        typeof fableEndpointUrl === 'string'
          ? fableEndpointUrl.trim()
          : storedCfg.fableEndpointUrl || '',
      fableModel:
        typeof fableModel === 'string'
          ? fableModel.trim()
          : storedCfg.fableModel || '',
      fableApiKey:
        typeof fableApiKey === 'string' && fableApiKey.trim()
          ? fableApiKey.trim()
          : storedCfg.fableApiKey || '',
      ollamaBaseUrl:
        typeof ollamaBaseUrl === 'string' && ollamaBaseUrl.trim()
          ? ollamaBaseUrl.trim()
          : storedCfg.ollamaBaseUrl || DEFAULT_CONFIG.ollamaBaseUrl,
      ollamaModel:
        typeof ollamaModel === 'string' && ollamaModel.trim()
          ? ollamaModel.trim()
          : storedCfg.ollamaModel || DEFAULT_CONFIG.ollamaModel,
    };

    const targetProvider =
      provider === 'fable' ? 'fable' : provider === 'ollama' ? 'ollama' : 'gemini';
    const startedAt = Date.now();
    const testModelName =
      targetProvider === 'fable'
        ? activeCfg.fableModel || 'endpoint-default'
        : targetProvider === 'ollama'
        ? activeCfg.ollamaModel
        : activeCfg.geminiModel || 'gemini-4-hydrogen';

    const logCtx = createLlmLog({
      requestType: 'test-adapter',
      route: '/api/astro/test-adapter',
      provider: targetProvider,
      model: testModelName,
      endpointUrl:
        targetProvider === 'fable'
          ? activeCfg.fableEndpointUrl
          : targetProvider === 'ollama'
          ? activeCfg.ollamaBaseUrl
          : undefined,
      query: { prompt: 'Connection check: reply with exactly OK.' },
    });

    try {
      if (targetProvider === 'ollama') {
        const reply = await callOllamaAdapter(
          activeCfg,
          [
            {
              role: 'user',
              content: 'Connection check: reply with exactly OK.',
            },
          ],
          false,
          logCtx
        );
        logCtx.record.status = 'parsed';
        logCtx.record.parsedOutput = { reply };
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.json({
          ok: true,
          provider: 'ollama',
          model: activeCfg.ollamaModel,
          latencyMs: Date.now() - startedAt,
          reply: reply.trim().slice(0, 140),
          logFile: logCtx.fileName,
        });
        return;
      }

      if (targetProvider === 'fable') {
        const reply = await callFableAdapter(
          activeCfg,
          [
            {
              role: 'user',
              content: 'Connection check: reply with exactly OK.',
            },
          ],
          false,
          logCtx
        );
        logCtx.record.status = 'parsed';
        logCtx.record.parsedOutput = { reply };
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.json({
          ok: true,
          provider: 'fable',
          model: activeCfg.fableModel || 'endpoint-default',
          latencyMs: Date.now() - startedAt,
          reply: reply.trim().slice(0, 140),
          logFile: logCtx.fileName,
        });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        const errMsg =
          'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.';
        logCtx.record.status = 'upstream_error';
        logCtx.record.error = errMsg;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.status(503).json({ error: errMsg });
        return;
      }

      const modelName = activeCfg.geminiModel || 'gemini-4-hydrogen';
      const response = await ai.models.generateContent({
        model: modelName,
        contents: 'Connection check: reply with exactly OK.',
      });

      const replyText = (response.text ?? '').trim();
      logCtx.record.httpStatus = 200;
      logCtx.record.rawHttpBody = JSON.stringify(response);
      logCtx.record.extractedText = replyText;
      logCtx.record.usage = response.usageMetadata;
      logCtx.record.status = 'parsed';
      logCtx.record.parsedOutput = { reply: replyText };
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);

      res.json({
        ok: true,
        provider: 'gemini',
        model: modelName,
        latencyMs: Date.now() - startedAt,
        reply: replyText.slice(0, 140) || 'OK',
        logFile: logCtx.fileName,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Adapter test failed.';
      logCtx.record.status = logCtx.record.status === 'pending' ? 'upstream_error' : logCtx.record.status;
      logCtx.record.error = message;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);
      res.status(502).json({ error: `${message} (Logged to logs/${logCtx.fileName})` });
    }
  });

  // 3-Fold Unified Magic Card Spread Analysis (Supports Gemini & Fable Adapters)
  app.post('/api/astro/analyze', async (req, res) => {
    const { profileName, natalDump, narrativeWindow, cards, futureWindow, llmConfig } = req.body;
    if (!natalDump || !narrativeWindow || !Array.isArray(cards) || !futureWindow) {
      res.status(400).json({ error: 'Missing required 3-fold astrological context.' });
      return;
    }

    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const activeCfg: PersistedConfig = {
      ...DEFAULT_CONFIG,
      ...storedCfg,
      ...(llmConfig || {}),
    };

    const { systemInstruction, userPrompt: prompt } = buildAnalyzePromptParts({
      profileName,
      natalDump,
      narrativeWindow,
      cards,
      futureWindow,
    });

    const targetProvider: 'gemini' | 'fable' | 'ollama' =
      activeCfg.llmProvider === 'fable'
        ? 'fable'
        : activeCfg.llmProvider === 'ollama'
        ? 'ollama'
        : 'gemini';

    const resolvedModel =
      targetProvider === 'fable'
        ? activeCfg.fableModel || 'endpoint-default'
        : targetProvider === 'ollama'
        ? activeCfg.ollamaModel || 'ollama'
        : activeCfg.geminiModel && activeCfg.geminiModel.trim()
        ? activeCfg.geminiModel.trim()
        : 'gemini-4-hydrogen';

    const logCtx = createLlmLog({
      requestType: 'submit-card',
      route: '/api/astro/analyze',
      provider: targetProvider,
      model: resolvedModel,
      endpointUrl:
        targetProvider === 'fable'
          ? activeCfg.fableEndpointUrl
          : targetProvider === 'ollama'
          ? activeCfg.ollamaBaseUrl
          : undefined,
      query: {
        profileName: profileName || null,
        narrativePeriod: `${narrativeWindow?.startMonth} to ${narrativeWindow?.endMonth}`,
        futurePeriod: `${futureWindow?.startMonth} to ${futureWindow?.endMonth}`,
        cards,
        systemInstruction,
        userPrompt: prompt,
      },
    });

    const parseOrRecoverAnalyze = (rawText: string) => {
      try {
        let parsed = parseLooseJson(rawText);
        // Unwrap nested data/result envelope if needed
        if (
          !('cardReadings' in parsed) &&
          !('overallSynthesis' in parsed) &&
          parsed.data &&
          typeof parsed.data === 'object' &&
          !Array.isArray(parsed.data)
        ) {
          parsed = parsed.data as Record<string, unknown>;
        } else if (
          !('cardReadings' in parsed) &&
          !('overallSynthesis' in parsed) &&
          parsed.result &&
          typeof parsed.result === 'object' &&
          !Array.isArray(parsed.result)
        ) {
          parsed = parsed.result as Record<string, unknown>;
        }

        const asStr = (val: unknown): string => {
          if (typeof val === 'string') return val.trim();
          if (val && typeof val === 'object') return JSON.stringify(val, null, 2);
          return val !== undefined && val !== null ? String(val).trim() : '';
        };

        const rawReadings = Array.isArray(parsed.cardReadings)
          ? (parsed.cardReadings as Array<Record<string, unknown>>)
          : Array.isArray(parsed.cards)
          ? (parsed.cards as Array<Record<string, unknown>>)
          : [];

        let normalizedReadings = rawReadings.map((r, idx) => ({
          cardId: asStr(r?.cardId || r?.id || cards[idx]?.id || cards[0]?.id || `card-${idx + 1}`),
          verdictSummary: asStr(r?.verdictSummary || r?.verdict || r?.summary || parsed.overallSynthesis),
          planetaryTriggers: asStr(
            r?.planetaryTriggers || r?.astrologicalReasoning || r?.reasoning || rawText
          ),
          timingWindow: asStr(r?.timingWindow || r?.timing || r?.window),
          guidance: asStr(r?.guidance || r?.advice || r?.nextSteps),
        }));

        // If model placed reading fields at top level without cardReadings array
        if (normalizedReadings.length === 0) {
          const topVerdict = asStr(
            parsed.verdictSummary || parsed.verdict || parsed.overallSynthesis || parsed.summary
          );
          const topReasoning = asStr(
            parsed.planetaryTriggers || parsed.astrologicalReasoning || parsed.reasoning
          );
          if (topVerdict || topReasoning) {
            normalizedReadings = cards.map((c: { id: string }) => ({
              cardId: c.id,
              verdictSummary: topVerdict || rawText.slice(0, 600),
              planetaryTriggers: topReasoning || rawText,
              timingWindow: asStr(parsed.timingWindow || parsed.timing),
              guidance: asStr(parsed.guidance || parsed.advice),
            }));
          }
        }

        if (normalizedReadings.length === 0) {
          const fallback = buildPlainTextFallbackReading(rawText, cards, logCtx.fileName);
          logCtx.record.status = 'fallback_plain_text';
          logCtx.record.error = 'Parsed JSON did not contain cardReadings; wrapped raw text for display.';
          logCtx.record.parsedOutput = fallback;
          logCtx.record.completedAt = new Date().toISOString();
          flushLlmLog(logCtx);
          return fallback;
        }

        const normalizedPayload = {
          overallSynthesis:
            asStr(parsed.overallSynthesis || parsed.synthesis || parsed.summary) ||
            normalizedReadings[0]?.verdictSummary ||
            '',
          cardReadings: normalizedReadings,
          _logFile: logCtx.fileName,
        };

        logCtx.record.status = 'parsed';
        logCtx.record.parsedOutput = normalizedPayload;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        return normalizedPayload;
      } catch (parseErr: unknown) {
        const errMsg = parseErr instanceof Error ? parseErr.message : 'Model response was not valid JSON.';
        const fallback = buildPlainTextFallbackReading(rawText, cards, logCtx.fileName);
        logCtx.record.status = 'fallback_plain_text';
        logCtx.record.error = errMsg;
        logCtx.record.parsedOutput = fallback;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        return fallback;
      }
    };

    try {
      if (targetProvider === 'ollama') {
        const rawOllama = await callOllamaAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          true,
          logCtx
        );
        res.json(parseOrRecoverAnalyze(rawOllama));
        return;
      }

      if (targetProvider === 'fable') {
        const rawFable = await callFableAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          true,
          logCtx
        );
        res.json(parseOrRecoverAnalyze(rawFable));
        return;
      }

      // Default: Gemini Adapter
      const ai = getAiClient();
      if (!ai) {
        const errMsg =
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets, or switch to the Fable Adapter in Settings.';
        logCtx.record.status = 'upstream_error';
        logCtx.record.error = errMsg;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.status(503).json({ error: errMsg });
        return;
      }

      const response = await ai.models.generateContent({
        model: resolvedModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallSynthesis: {
                type: Type.STRING,
              },
              cardReadings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cardId: { type: Type.STRING },
                    verdictSummary: { type: Type.STRING },
                    planetaryTriggers: { type: Type.STRING },
                    timingWindow: { type: Type.STRING },
                    guidance: { type: Type.STRING },
                  },
                  required: ['cardId', 'verdictSummary', 'planetaryTriggers', 'timingWindow', 'guidance'],
                },
              },
            },
            required: ['overallSynthesis', 'cardReadings'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      // Save raw Gemini response BEFORE parsing
      logCtx.record.httpStatus = 200;
      logCtx.record.rawHttpBody = JSON.stringify(response);
      logCtx.record.extractedText = raw;
      logCtx.record.usage = response.usageMetadata;
      logCtx.record.status = 'received';
      flushLlmLog(logCtx);

      res.json(parseOrRecoverAnalyze(raw));
    } catch (err: unknown) {
      console.error('Analyze error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate astrological reading.';
      if (!logCtx.record.error) {
        logCtx.record.status = logCtx.record.status === 'received' ? 'parse_error' : 'upstream_error';
        logCtx.record.error = message;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
      }
      res.status(502).json({ error: `${message} (Log saved: logs/${logCtx.fileName})` });
    }
  });

  // Secondary Request 2: Same-Engine Graha Influence Timeline Extraction (Gemini / Fable / Ollama)
  app.post('/api/astro/timeline-decision', async (req, res) => {
    const {
      domain,
      title,
      eventDate,
      narrative,
      question,
      pastStartMonth,
      pastEndMonth,
      futureStartMonth,
      futureEndMonth,
      natalDump,
      pastTransitDump,
      futureTransitDump,
      verdictSummary,
      timingWindow,
      guidance,
      planetaryTriggers,
      llmConfig,
    } = req.body || {};

    if (!planetaryTriggers || typeof planetaryTriggers !== 'string') {
      res.status(400).json({ error: 'Missing Request 1 reasoning narrative for timeline extraction.' });
      return;
    }

    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const activeCfg: PersistedConfig = {
      ...DEFAULT_CONFIG,
      ...storedCfg,
      ...(llmConfig || {}),
    };

    const targetProvider =
      activeCfg.llmProvider === 'fable'
        ? 'fable'
        : activeCfg.llmProvider === 'ollama'
        ? 'ollama'
        : 'gemini';

    const { systemInstruction, userPrompt, windowBounds } = buildGrahaTimelineExtractionPrompt({
      domain: domain || 'General',
      title: title || 'Event',
      eventDate: eventDate || '',
      narrative: narrative || '',
      question: question || '',
      pastStartMonth: pastStartMonth || '',
      pastEndMonth: pastEndMonth || '',
      futureStartMonth: futureStartMonth || '',
      futureEndMonth: futureEndMonth || '',
      natalDump: typeof natalDump === 'string' ? natalDump : '',
      pastTransitDump: typeof pastTransitDump === 'string' ? pastTransitDump : '',
      futureTransitDump: typeof futureTransitDump === 'string' ? futureTransitDump : '',
      verdictSummary: verdictSummary || '',
      timingWindow: timingWindow || '',
      guidance: typeof guidance === 'string' ? guidance : '',
      planetaryTriggers,
    });

    const isValidIsoDate = (val: unknown): val is string => {
      if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return false;
      const [y, m, d] = val.trim().split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return !Number.isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
    };

    const resolvedTimelineModel =
      targetProvider === 'ollama'
        ? activeCfg.ollamaModel || 'ollama'
        : targetProvider === 'fable'
        ? activeCfg.fableModel || 'fable'
        : activeCfg.geminiModel && activeCfg.geminiModel.trim()
        ? activeCfg.geminiModel.trim()
        : 'gemini-4-hydrogen';

    const logCtx = createLlmLog({
      requestType: 'astro-reasoning',
      route: '/api/astro/timeline-decision',
      provider: targetProvider,
      model: resolvedTimelineModel,
      endpointUrl:
        targetProvider === 'fable'
          ? activeCfg.fableEndpointUrl
          : targetProvider === 'ollama'
          ? activeCfg.ollamaBaseUrl
          : undefined,
      query: {
        domain: domain || 'General',
        title: title || 'Event',
        eventDate: eventDate || '',
        narrative: narrative || '',
        question: question || '',
        pastPeriod: `${pastStartMonth || ''} to ${pastEndMonth || ''}`,
        futurePeriod: `${futureStartMonth || ''} to ${futureEndMonth || ''}`,
        verdictSummary: verdictSummary || '',
        timingWindow: timingWindow || '',
        planetaryTriggers,
        systemInstruction,
        userPrompt,
      },
    });

    try {
      let parsed: Record<string, unknown>;
      let usedModel = resolvedTimelineModel;

      if (targetProvider === 'ollama') {
        const rawOllama = await callOllamaAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          true,
          logCtx
        );
        parsed = parseLooseJson(rawOllama);
      } else if (targetProvider === 'fable') {
        const rawFable = await callFableAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          true,
          logCtx
        );
        parsed = parseLooseJson(rawFable);
      } else {
        const ai = getAiClient();
        if (!ai) {
          const errMsg =
            'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets.';
          logCtx.record.status = 'upstream_error';
          logCtx.record.error = errMsg;
          logCtx.record.completedAt = new Date().toISOString();
          flushLlmLog(logCtx);
          res.status(503).json({ error: errMsg });
          return;
        }

        const response = await ai.models.generateContent({
          model: usedModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                outcome_label: { type: Type.STRING },
                window: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING },
                    end: { type: Type.STRING },
                  },
                  required: ['start', 'end'],
                },
                dasha_line: { type: Type.STRING },
                planets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      role: { type: Type.STRING },
                    },
                    required: ['name', 'role'],
                  },
                },
                retrograde: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      planet: { type: Type.STRING },
                      from: { type: Type.STRING },
                      to: { type: Type.STRING },
                    },
                    required: ['planet', 'from'],
                  },
                },
                links: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      from: { type: Type.STRING },
                      to: { type: Type.STRING },
                      from_date: { type: Type.STRING },
                    },
                    required: ['from', 'to', 'from_date'],
                  },
                },
                factors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      planet: { type: Type.STRING },
                      polarity: { type: Type.STRING },
                      strength: { type: Type.NUMBER },
                      start: { type: Type.STRING },
                      end: { type: Type.STRING },
                      tag: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                      why_strength: { type: Type.STRING },
                    },
                    required: [
                      'planet',
                      'polarity',
                      'strength',
                      'start',
                      'end',
                      'tag',
                      'reasoning',
                      'why_strength',
                    ],
                  },
                },
                review_flags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'title',
                'outcome_label',
                'window',
                'dasha_line',
                'planets',
                'retrograde',
                'links',
                'factors',
                'review_flags',
              ],
            },
          },
        });
        const rawGeminiText = (response.text ?? '{}').trim();
        logCtx.record.httpStatus = 200;
        logCtx.record.rawHttpBody = JSON.stringify(response);
        logCtx.record.extractedText = rawGeminiText;
        logCtx.record.usage = response.usageMetadata;
        logCtx.record.status = 'received';
        flushLlmLog(logCtx);
        parsed = parseLooseJson(rawGeminiText);
      }

      const rawWin =
        parsed.window && typeof parsed.window === 'object'
          ? (parsed.window as Record<string, unknown>)
          : {};
      const winStart = isValidIsoDate(rawWin.start) ? rawWin.start.trim() : windowBounds.start;
      const winEnd =
        isValidIsoDate(rawWin.end) && rawWin.end.trim() >= winStart
          ? rawWin.end.trim()
          : windowBounds.end >= winStart
          ? windowBounds.end
          : winStart;

      const rawFactors = Array.isArray(parsed.factors) ? parsed.factors : [];
      const factors = rawFactors
        .map((f: Record<string, unknown>) => {
          const planet = typeof f?.planet === 'string' && f.planet.trim() ? f.planet.trim() : '';
          if (!planet) return null;
          const polarity: 'support' | 'friction' =
            String(f?.polarity || '').toLowerCase() === 'support' ? 'support' : 'friction';
          const numStrength = Number(f?.strength);
          const strength = Number.isFinite(numStrength)
            ? Math.min(5, Math.max(1, Math.round(numStrength * 10) / 10))
            : 2;
          const start = isValidIsoDate(f?.start) ? f.start.trim() : winStart;
          const endRaw = isValidIsoDate(f?.end) ? f.end.trim() : winEnd;
          const end = endRaw < start ? start : endRaw;
          return {
            planet,
            polarity,
            strength,
            start,
            end,
            tag: typeof f?.tag === 'string' ? f.tag.trim() : '',
            reasoning: typeof f?.reasoning === 'string' ? f.reasoning.trim() : '',
            why_strength: typeof f?.why_strength === 'string' ? f.why_strength.trim() : '',
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const planetMap = new Map<string, { name: string; role?: string }>();
      if (Array.isArray(parsed.planets)) {
        for (const p of parsed.planets as Array<Record<string, unknown>>) {
          const name = typeof p?.name === 'string' ? p.name.trim() : '';
          if (name && !planetMap.has(name)) {
            planetMap.set(name, {
              name,
              role: typeof p?.role === 'string' ? p.role.trim() : undefined,
            });
          }
        }
      }
      for (const f of factors) {
        if (!planetMap.has(f.planet)) {
          planetMap.set(f.planet, { name: f.planet });
        }
      }

      const retrograde = Array.isArray(parsed.retrograde)
        ? (parsed.retrograde as Array<Record<string, unknown>>)
            .map((r) => {
              const planet = typeof r?.planet === 'string' ? r.planet.trim() : '';
              if (!planet || !isValidIsoDate(r?.from)) return null;
              const entry: { planet: string; from: string; to?: string } = {
                planet,
                from: r.from.trim(),
              };
              if (isValidIsoDate(r?.to) && r.to.trim() >= entry.from) {
                entry.to = r.to.trim();
              }
              return entry;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
        : [];

      const links = Array.isArray(parsed.links)
        ? (parsed.links as Array<Record<string, unknown>>)
            .map((l) => {
              const from = typeof l?.from === 'string' ? l.from.trim() : '';
              const to = typeof l?.to === 'string' ? l.to.trim() : '';
              if (!from || !to || !isValidIsoDate(l?.from_date)) return null;
              return { from, to, from_date: l.from_date.trim() };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
        : [];

      const review_flags = Array.isArray(parsed.review_flags)
        ? (parsed.review_flags as unknown[])
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : [];

      const grahaTimeline = {
        generatedByProvider: targetProvider,
        generatedByModel: usedModel,
        title:
          typeof parsed.title === 'string' && parsed.title.trim()
            ? parsed.title.trim()
            : 'Graha influence timeline',
        outcome_label:
          typeof parsed.outcome_label === 'string' && parsed.outcome_label.trim()
            ? parsed.outcome_label.trim()
            : domain || 'Outcome',
        window: {
          start: winStart,
          end: winEnd,
        },
        dasha_line: typeof parsed.dasha_line === 'string' ? parsed.dasha_line.trim() : '',
        planets: Array.from(planetMap.values()),
        retrograde,
        links,
        factors,
        review_flags,
      };

      logCtx.record.status = 'parsed';
      logCtx.record.parsedOutput = grahaTimeline;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);

      res.json({ grahaTimeline, _logFile: logCtx.fileName });
    } catch (err: unknown) {
      console.error('Timeline extraction error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to extract Graha timeline plot data.';
      logCtx.record.status = logCtx.record.status === 'received' ? 'parse_error' : 'upstream_error';
      logCtx.record.error = message;
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);
      res.status(502).json({ error: `${message} (Raw response saved to logs/${logCtx.fileName})` });
    }
  });

  // Persistent 3-Fold Thread Follow-Up Chat (Supports Gemini & Fable Adapters)
  app.post('/api/astro/chat', async (req, res) => {
    const {
      profileName,
      natalDump,
      narrativeWindow,
      cards,
      futureWindow,
      history,
      userMessage,
      llmConfig,
    } = req.body;
    if (!natalDump || !userMessage) {
      res.status(400).json({ error: 'Missing required thread context or message.' });
      return;
    }

    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const activeCfg: PersistedConfig = {
      ...DEFAULT_CONFIG,
      ...storedCfg,
      ...(llmConfig || {}),
    };

    const cardsContext = (cards || [])
      .map(
        (
          c: {
            domain: string;
            title: string;
            eventDate: string;
            narrative: string;
            question: string;
            reading?: { verdictSummary: string; timingWindow: string };
          },
          i: number
        ) =>
          `Card ${i + 1} [${c.domain}] (${c.eventDate}): "${c.title}" — Narrative: ${c.narrative} | Question: ${c.question}${
            c.reading ? ` | Initial Reading: ${c.reading.verdictSummary} (Timing: ${c.reading.timingWindow})` : ''
          }`
      )
      .join('\n');

    const systemInstruction = `You are Astro AI Studio conducting a persistent multi-turn thread for ${profileName || 'the user'}.
All 3 Context Folds remain permanently active for this entire thread:

[FOLD 1 — SESSION NATAL BASELINE]
${natalDump}

[FOLD 2 — PAST CALIBRATION NARRATIVE: ${narrativeWindow?.startMonth} to ${narrativeWindow?.endMonth}]
Transits:
${narrativeWindow?.transitDump || 'N/A'}

Submitted Magic Cards:
${cardsContext}

[FOLD 3 — FUTURE TRANSIT WINDOW: ${futureWindow?.startMonth} to ${futureWindow?.endMonth}]
${futureWindow?.transitDump || 'N/A'}

Answer follow-up questions in strictly realistic, grounded, real-world terms—describing practical possibilities, timing, and actions without mentioning astrology, planets, charts, houses, dasha, or transits unless the user explicitly asks for the astrological explanation. Keep answers clear, structured, and crisp.`;

    const chatProvider: 'gemini' | 'fable' | 'ollama' =
      activeCfg.llmProvider === 'fable'
        ? 'fable'
        : activeCfg.llmProvider === 'ollama'
        ? 'ollama'
        : 'gemini';

    const chatModel =
      chatProvider === 'fable'
        ? activeCfg.fableModel || 'endpoint-default'
        : chatProvider === 'ollama'
        ? activeCfg.ollamaModel || 'ollama'
        : activeCfg.geminiModel && activeCfg.geminiModel.trim()
        ? activeCfg.geminiModel.trim()
        : 'gemini-4-hydrogen';

    const logCtx = createLlmLog({
      requestType: 'follow-up-chat',
      route: '/api/astro/chat',
      provider: chatProvider,
      model: chatModel,
      endpointUrl:
        chatProvider === 'fable'
          ? activeCfg.fableEndpointUrl
          : chatProvider === 'ollama'
          ? activeCfg.ollamaBaseUrl
          : undefined,
      query: {
        profileName: profileName || null,
        userMessage,
        historyCount: Array.isArray(history) ? history.length : 0,
        systemInstruction,
        history: history || [],
      },
    });

    try {
      if (chatProvider === 'ollama') {
        const ollamaMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemInstruction },
          ...(history || []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage },
        ];
        const reply = await callOllamaAdapter(activeCfg, ollamaMessages, false, logCtx);
        const cleanedReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        logCtx.record.status = 'parsed';
        logCtx.record.parsedOutput = { reply: cleanedReply };
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.json({ reply: cleanedReply, _logFile: logCtx.fileName });
        return;
      }

      if (chatProvider === 'fable') {
        const fableMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemInstruction },
          ...(history || []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage },
        ];
        const reply = await callFableAdapter(activeCfg, fableMessages, false, logCtx);
        logCtx.record.status = 'parsed';
        logCtx.record.parsedOutput = { reply };
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.json({ reply, _logFile: logCtx.fileName });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        const errMsg =
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets, or switch to the Fable Adapter in Settings.';
        logCtx.record.status = 'upstream_error';
        logCtx.record.error = errMsg;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
        res.status(503).json({ error: errMsg });
        return;
      }

      const transcript = (history || [])
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Astro AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = transcript ? `${transcript}\n\nUser: ${userMessage}` : `User: ${userMessage}`;

      const response = await ai.models.generateContent({
        model: chatModel,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text ?? 'Unable to generate response.';
      logCtx.record.httpStatus = 200;
      logCtx.record.rawHttpBody = JSON.stringify(response);
      logCtx.record.extractedText = replyText;
      logCtx.record.usage = response.usageMetadata;
      logCtx.record.status = 'parsed';
      logCtx.record.parsedOutput = { reply: replyText };
      logCtx.record.completedAt = new Date().toISOString();
      flushLlmLog(logCtx);

      res.json({ reply: replyText, _logFile: logCtx.fileName });
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const message = err instanceof Error ? err.message : 'Failed to process follow-up question.';
      if (!logCtx.record.error) {
        logCtx.record.status = 'upstream_error';
        logCtx.record.error = message;
        logCtx.record.completedAt = new Date().toISOString();
        flushLlmLog(logCtx);
      }
      res.status(502).json({ error: `${message} (Log saved: logs/${logCtx.fileName})` });
    }
  });

  // List & inspect saved per-request LLM logs in logs/
  app.get('/api/logs', (_req, res) => {
    try {
      ensureLogsDir();
      const files = fs
        .readdirSync(LOGS_DIR)
        .filter((f) => f.endsWith('.log') || f.endsWith('.txt') || f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 100);
      res.json({ logsDir: 'logs/', files });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to list logs.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/logs/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename || '');
    if (
      !safeName ||
      (!safeName.endsWith('.log') && !safeName.endsWith('.txt') && !safeName.endsWith('.json'))
    ) {
      res.status(400).json({ error: 'Invalid log filename.' });
      return;
    }
    const target = path.join(LOGS_DIR, safeName);
    if (!fs.existsSync(target)) {
      res.status(404).json({ error: 'Log file not found.' });
      return;
    }
    res.type(safeName.endsWith('.json') ? 'application/json' : 'text/plain').send(
      fs.readFileSync(target, 'utf-8')
    );
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  http.createServer(app).listen(PORT, '0.0.0.0', () => {
    console.log(`Astro AI Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
