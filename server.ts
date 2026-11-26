import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { buildAnalyzePromptParts } from './src/data/promptBuilder.ts';

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
  llmProvider: 'gemini' | 'fable';
  geminiModel: string;
  fableEndpointUrl: string;
  fableModel: string;
  fableApiKey: string;
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

function parseLooseJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
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

  // Live Adapter Connection Test (Gemini & Fable)
  app.post('/api/astro/test-adapter', async (req, res) => {
    const {
      provider,
      geminiModel,
      fableEndpointUrl,
      fableModel,
      fableApiKey,
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
    };

    const targetProvider = provider === 'fable' ? 'fable' : 'gemini';
    const startedAt = Date.now();

    try {
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
