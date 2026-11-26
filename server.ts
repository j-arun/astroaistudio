import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { buildAnalyzePromptParts } from './src/data/promptBuilder.ts';
import { buildTimelineDecisionPrompt } from './src/data/timelinePromptBuilder.ts';

dotenv.config();

const PRIMARY_PORT = Number(process.env.ASTRO_PORT) || 6001;
const PREVIEW_PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.astro-studio-data');
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

async function callFableAdapter(
  cfg: PersistedConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  expectJson: boolean
): Promise<string> {
  if (!cfg.fableEndpointUrl || !cfg.fableEndpointUrl.trim()) {
    throw new Error(
      'Fable LLM Adapter endpoint URL is not configured. Open Settings -> LLM Adapters to enter your Fable endpoint.'
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cfg.fableApiKey && cfg.fableApiKey.trim()) {
    headers['Authorization'] = cfg.fableApiKey.startsWith('Bearer ')
      ? cfg.fableApiKey.trim()
      : `Bearer ${cfg.fableApiKey.trim()}`;
  }

  const bodyPayload: Record<string, unknown> = {
    messages,
  };
  if (cfg.fableModel && cfg.fableModel.trim()) {
    bodyPayload.model = cfg.fableModel.trim();
  }
  if (expectJson) {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const upstream = await fetch(cfg.fableEndpointUrl.trim(), {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Fable Adapter returned ${upstream.status}: ${raw.slice(0, 260)}`);
  }

  try {
    const parsed = JSON.parse(raw);
    const content =
      parsed?.choices?.[0]?.message?.content ??
      parsed?.output_text ??
      parsed?.reply ??
      parsed?.text ??
      parsed?.content;
    if (typeof content === 'string') return content;
    return raw;
  } catch {
    return raw;
  }
}

function normalizeOllamaBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
  return trimmed.replace(/\/api\/(chat|generate|tags)$/i, '');
}

async function callOllamaAdapter(
  cfg: PersistedConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  expectJson: boolean
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
  if (!upstream.ok) {
    throw new Error(`Ollama returned ${upstream.status}: ${raw.slice(0, 260)}`);
  }

  try {
    const parsed = JSON.parse(raw);
    const content = parsed?.message?.content ?? parsed?.response;
    if (typeof content === 'string') return content;
    return raw;
  } catch {
    return raw;
  }
}

function parseLooseJson(rawText: string): Record<string, unknown> {
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const cleaned = withoutThink
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Model response was not valid JSON.');
  }
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
        typeof fableApiKey === 'string'
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
          false
        );
        res.json({
          ok: true,
          provider: 'ollama',
          model: activeCfg.ollamaModel,
          latencyMs: Date.now() - startedAt,
          reply: reply.trim().slice(0, 140),
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
          false
        );
        res.json({
          ok: true,
          provider: 'fable',
          model: activeCfg.fableModel || 'endpoint-default',
          latencyMs: Date.now() - startedAt,
          reply: reply.trim().slice(0, 140),
        });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const modelName = activeCfg.geminiModel || 'gemini-4-hydrogen';
      const response = await ai.models.generateContent({
        model: modelName,
        contents: 'Connection check: reply with exactly OK.',
      });

      res.json({
        ok: true,
        provider: 'gemini',
        model: modelName,
        latencyMs: Date.now() - startedAt,
        reply: (response.text ?? '').trim().slice(0, 140) || 'OK',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Adapter test failed.';
      res.status(502).json({ error: message });
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

    try {
      if (activeCfg.llmProvider === 'ollama') {
        const rawOllama = await callOllamaAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          true
        );
        const parsed = parseLooseJson(rawOllama);
        res.json(parsed);
        return;
      }

      if (activeCfg.llmProvider === 'fable') {
        const rawFable = await callFableAdapter(
          activeCfg,
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          true
        );
        const parsed = parseLooseJson(rawFable);
        res.json(parsed);
        return;
      }

      // Default: Gemini Adapter
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets, or switch to the Fable Adapter in Settings.',
        });
        return;
      }

      const geminiModel =
        activeCfg.geminiModel && activeCfg.geminiModel.trim()
          ? activeCfg.geminiModel.trim()
          : 'gemini-4-hydrogen';

      const response = await ai.models.generateContent({
        model: geminiModel,
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
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err: unknown) {
      console.error('Analyze error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate astrological reading.';
      res.status(502).json({ error: message });
    }
  });

  // Secondary Timeline Decision Engine (Private LLM / Ollama only, fed Public LLM reasoning text)
  app.post('/api/astro/timeline-decision', async (req, res) => {
    const {
      domain,
      title,
      eventDate,
      question,
      pastRangeLabel,
      futureRangeLabel,
      verdictSummary,
      timingWindow,
      planetaryTriggers,
      llmConfig,
    } = req.body || {};

    if (!planetaryTriggers || typeof planetaryTriggers !== 'string') {
      res.status(400).json({ error: 'Missing public reasoning narrative for timeline engine.' });
      return;
    }

    const storedCfg = readJsonFile<Partial<PersistedConfig>>(API_CONFIG_FILE, {});
    const activeCfg: PersistedConfig = {
      ...DEFAULT_CONFIG,
      ...storedCfg,
      ...(llmConfig || {}),
    };

    const { systemInstruction, userPrompt } = buildTimelineDecisionPrompt({
      domain: domain || 'General',
      title: title || 'Event',
      eventDate: eventDate || '',
      question: question || '',
      pastRangeLabel: pastRangeLabel || 'Past Period',
      futureRangeLabel: futureRangeLabel || 'Future Period',
      verdictSummary: verdictSummary || '',
      timingWindow: timingWindow || '',
      planetaryTriggers,
    });

    try {
      const rawOllama = await callOllamaAdapter(
        activeCfg,
        [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        true
      );
      const parsed = parseLooseJson(rawOllama);

      const rawStages = Array.isArray(parsed.stages) ? parsed.stages : [];
      const stages = rawStages.map((s: Record<string, unknown>, idx: number) => {
        const score = Number(s?.flowScore);
        const clampedScore = Number.isFinite(score)
          ? Math.min(95, Math.max(8, score))
          : idx === 0
          ? 34
          : idx === 1
          ? 48
          : idx === 2
          ? 64
          : 78;
        const dir =
          s?.direction === 'pullback' || s?.direction === 'shift' || s?.direction === 'flow'
            ? s.direction
            : clampedScore < 45
            ? 'pullback'
            : clampedScore < 60
            ? 'shift'
            : 'flow';

        return {
          phase: typeof s?.phase === 'string' ? s.phase : `Stage ${idx + 1}`,
          dateRange: typeof s?.dateRange === 'string' ? s.dateRange : '',
          stateLabel: typeof s?.stateLabel === 'string' ? s.stateLabel : 'Transition',
          direction: dir,
          flowScore: clampedScore,
          trigger: typeof s?.trigger === 'string' ? s.trigger : 'Transit Shift',
          explanation: typeof s?.explanation === 'string' ? s.explanation : '',
        };
      });

      const rawKeyHolder =
        parsed.keyHolder && typeof parsed.keyHolder === 'object'
          ? (parsed.keyHolder as Record<string, unknown>)
          : {};

      const timelineFlow = {
        generatedByModel: activeCfg.ollamaModel || 'ollama',
        keyHolder: {
          name:
            typeof rawKeyHolder.name === 'string' && rawKeyHolder.name.trim()
              ? rawKeyHolder.name
              : 'Primary Chart Factor',
          role:
            typeof rawKeyHolder.role === 'string' && rawKeyHolder.role.trim()
              ? rawKeyHolder.role
              : 'Primary Decision Lever',
          why: typeof rawKeyHolder.why === 'string' ? rawKeyHolder.why : '',
        },
        factors: Array.isArray(parsed.factors)
          ? (parsed.factors as Array<Record<string, unknown>>).map((f) => ({
              name: typeof f?.name === 'string' ? f.name : 'Factor',
              role: typeof f?.role === 'string' ? f.role : 'Anchor',
              impact: typeof f?.impact === 'string' ? f.impact : '',
            }))
          : [],
        stages,
        edges: Array.isArray(parsed.edges)
          ? (parsed.edges as Array<Record<string, unknown>>).map((e) => ({
              from: typeof e?.from === 'string' ? e.from : 'Trigger',
              relation: typeof e?.relation === 'string' ? e.relation : 'influences',
              to: typeof e?.to === 'string' ? e.to : 'Outcome',
              effect: typeof e?.effect === 'string' ? e.effect : '',
            }))
          : [],
      };

      res.json({ timelineFlow });
    } catch (err: unknown) {
      console.error('Timeline decision error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Private LLM (Ollama) failed to generate timeline decision flow.';
      res.status(502).json({ error: message });
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

    try {
      if (activeCfg.llmProvider === 'ollama') {
        const ollamaMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemInstruction },
          ...(history || []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage },
        ];
        const reply = await callOllamaAdapter(activeCfg, ollamaMessages, false);
        res.json({ reply: reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() });
        return;
      }

      if (activeCfg.llmProvider === 'fable') {
        const fableMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemInstruction },
          ...(history || []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage },
        ];
        const reply = await callFableAdapter(activeCfg, fableMessages, false);
        res.json({ reply });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets, or switch to the Fable Adapter in Settings.',
        });
        return;
      }

      const geminiModel =
        activeCfg.geminiModel && activeCfg.geminiModel.trim()
          ? activeCfg.geminiModel.trim()
          : 'gemini-4-hydrogen';

      const transcript = (history || [])
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Astro AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = transcript ? `${transcript}\n\nUser: ${userMessage}` : `User: ${userMessage}`;

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      res.json({ reply: response.text ?? 'Unable to generate response.' });
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const message = err instanceof Error ? err.message : 'Failed to process follow-up question.';
      res.status(502).json({ error: message });
    }
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

  http.createServer(app).listen(PRIMARY_PORT, '0.0.0.0', () => {
    console.log(`Astro AI Studio listening on http://0.0.0.0:${PRIMARY_PORT}`);
  });

  if (process.env.DISABLE_HMR === 'true' && PRIMARY_PORT !== PREVIEW_PORT) {
    http.createServer(app).listen(PREVIEW_PORT, '0.0.0.0', () => {
      console.log(`Astro AI Studio preview bridge listening on http://0.0.0.0:${PREVIEW_PORT}`);
    });
  }
}

startServer();
