import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.astro-studio-data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const THREADS_FILE = path.join(DATA_DIR, 'threads.json');
const API_CONFIG_FILE = path.join(DATA_DIR, 'api-config.json');

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Disk-backed Profiles API
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

  // Disk-backed Threads API
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

  // Disk-backed External API Config (Natal API URL + Transit API URL)
  app.get('/api/config', (_req, res) => {
    const config = readJsonFile(API_CONFIG_FILE, {
      natalApiUrl: '',
      transitApiUrl: '',
      apiBearerToken: '',
    });
    res.json({ config });
  });

  app.post('/api/config', (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Invalid config payload.' });
      return;
    }
    writeJsonFile(API_CONFIG_FILE, config);
    res.json({ ok: true });
  });

  // Server-side Proxy to Fetch Plain-Text Natal or Transit Dump from User-Provided API
  app.post('/api/external/fetch-dump', async (req, res) => {
    const { url, method = 'POST', bearerToken, payload } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Please provide a valid API endpoint URL.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.status(400).json({ error: 'Malformed URL.' });
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

      let targetUrl = parsedUrl.toString();
      const upperMethod = String(method).toUpperCase() === 'GET' ? 'GET' : 'POST';

      const fetchInit: RequestInit = { method: upperMethod, headers };
      if (upperMethod === 'POST') {
        headers['Content-Type'] = 'application/json';
        fetchInit.body = JSON.stringify(payload || {});
      } else if (payload && typeof payload === 'object') {
        const u = new URL(targetUrl);
        for (const [k, v] of Object.entries(payload)) {
          if (v !== undefined && v !== null) {
            u.searchParams.set(k, String(v));
          }
        }
        targetUrl = u.toString();
      }

      const upstream = await fetch(targetUrl, fetchInit);
      const rawBody = await upstream.text();
      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: `Upstream API returned ${upstream.status}: ${rawBody.slice(0, 240)}`,
        });
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const text = extractPlainTextFromResponse(contentType, rawBody);
      res.json({ text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to call external API.';
      res.status(502).json({ error: message });
    }
  });

  // 3-Fold Unified Magic Card Spread Analysis
  app.post('/api/astro/analyze', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets to generate live Vedic readings.',
      });
      return;
    }

    const { profileName, natalDump, narrativeWindow, cards, futureWindow } = req.body;
    if (!natalDump || !narrativeWindow || !Array.isArray(cards) || !futureWindow) {
      res.status(400).json({ error: 'Missing required 3-fold astrological context.' });
      return;
    }

    const systemInstruction = `You are Astro AI Studio, a master Vedic astrologer (Jyotish) operating inside a unified 3-Fold Context Architecture:
- FOLD 1 (SESSION NATAL BASELINE): Complete natal dump for ${profileName || 'the user'} including D1-D144 divisional charts, Vimshottari Dasha-Bhukti-Antara, Moon Sign (Janma Rasi), and SAV/BAV Ashtakavarga bindus.
- FOLD 2 (PAST CALIBRATION NARRATIVE): A strict 1-3 month past window (${narrativeWindow.startMonth} to ${narrativeWindow.endMonth}) with Gochara transits AND real dated life event cards ("Magic Cards") that actually occurred. Use these past events to calibrate how Dasha + Gochara + SAV/BAV physically manifest for this chart.
- FOLD 3 (TARGET FUTURE WINDOW): The future transit window (${futureWindow.startMonth} to ${futureWindow.endMonth}) with its Gochara transits and the user's specific card questions.

Analyze EVERY card rigorously using house lordships, Dasha-Bhukti-Antara shifts, relevant divisional charts (D9, D10, D24, D60), SAV/BAV bindu strength, and Gochara from Janma Rasi (Moon sign). Be concrete, grounded, insightful, and concise so each card unfolds cleanly in the workspace spread.`;

    const cardsSummary = cards
      .map(
        (
          c: {
            id: string;
            domain: string;
            title: string;
            eventDate: string;
            narrative: string;
            question: string;
          },
          idx: number
        ) =>
          `CARD #${idx + 1} (id: ${c.id})
- Domain: ${c.domain}
- Past Event Title: ${c.title}
- Past Event Date: ${c.eventDate}
- Past Event Narrative: ${c.narrative}
- Future Question for ${futureWindow.startMonth} to ${futureWindow.endMonth}: ${c.question || 'General outlook for this domain in the future window.'}`
      )
      .join('\n\n');

    const prompt = `=== FOLD 1: NATAL DUMP ===
${natalDump}

=== FOLD 2: PAST NARRATIVE WINDOW (${narrativeWindow.startMonth} to ${narrativeWindow.endMonth}) ===
PAST TRANSITS:
${narrativeWindow.transitDump}

PAST EVENT MAGIC CARDS & QUESTIONS:
${cardsSummary}

=== FOLD 3: FUTURE TRANSIT WINDOW (${futureWindow.startMonth} to ${futureWindow.endMonth}) ===
FUTURE TRANSITS:
${futureWindow.transitDump}

Provide a structured synthesis for the full future window plus a dedicated reading for every single card id.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallSynthesis: {
                type: Type.STRING,
                description:
                  '2-3 sentence macro synthesis connecting the active Dasha-Bhukti, past calibration window, and future transit window.',
              },
              cardReadings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cardId: { type: Type.STRING },
                    verdictSummary: {
                      type: Type.STRING,
                      description: 'Direct, clear answer to the card question in 2-3 sentences.',
                    },
                    planetaryTriggers: {
                      type: Type.STRING,
                      description:
                        'Specific Dasha-Bhukti, Gochara from Moon Sign, divisional chart (D9/D10/D24), and SAV/BAV bindu alignment.',
                    },
                    timingWindow: {
                      type: Type.STRING,
                      description:
                        'Most active date sub-window inside the future range (e.g. Late Jan – Mid Feb).',
                    },
                    guidance: {
                      type: Type.STRING,
                      description: 'Practical, grounded next step or timing advice in 1-2 sentences.',
                    },
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
      console.error('Gemini analyze error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate astrological reading.';
      res.status(502).json({ error: message });
    }
  });

  // Persistent 3-Fold Thread Follow-Up Chat
  app.post('/api/astro/chat', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets to continue chatting.',
      });
      return;
    }

    const { profileName, natalDump, narrativeWindow, cards, futureWindow, history, userMessage } = req.body;
    if (!natalDump || !userMessage) {
      res.status(400).json({ error: 'Missing required thread context or message.' });
      return;
    }

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

Answer follow-up questions with direct references to specific Card numbers, exact dates, Dasha-Bhukti-Antara, divisional charts (D1-D144), SAV/BAV bindus, and Moon-sign Gochara. Keep answers clear, structured, and crisp.`;

    const transcript = (history || [])
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Astro AI'}: ${m.content}`)
      .join('\n\n');

    const prompt = transcript ? `${transcript}\n\nUser: ${userMessage}` : `User: ${userMessage}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      res.json({ reply: response.text ?? 'Unable to generate response.' });
    } catch (err: unknown) {
      console.error('Gemini chat error:', err);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Astro AI Studio running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
