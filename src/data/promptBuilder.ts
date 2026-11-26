export interface PromptCardInput {
  id: string;
  domain: string;
  title: string;
  eventDate: string;
  narrative: string;
  question: string;
}

export interface PromptWindowInput {
  startMonth: string;
  endMonth: string;
  transitDump: string;
}

export interface BuildAnalyzePromptParams {
  profileName?: string;
  natalDump: string;
  narrativeWindow: PromptWindowInput;
  cards: PromptCardInput[];
  futureWindow: PromptWindowInput;
}

export function buildAnalyzePromptParts({
  profileName,
  natalDump,
  narrativeWindow,
  cards,
  futureWindow,
}: BuildAnalyzePromptParams): {
  systemInstruction: string;
  userPrompt: string;
  fullCombinedPrompt: string;
} {
  const systemInstruction = `You are a master Jyotish (Vedic astrology) analyst powering a real-world scenario foresight workspace for ${profileName || 'the user'}.
Internally, perform your full astrological synthesis using all 3 folds:
- FOLD 1 (SESSION NATAL BASELINE): Complete natal dump including D1-D144 divisional charts, Vimshottari Dasha-Bhukti-Antara, Moon Sign (Janma Rasi), and SAV/BAV Ashtakavarga bindus.
- FOLD 2 (PAST CALIBRATION NARRATIVE): The past window (${narrativeWindow.startMonth} to ${narrativeWindow.endMonth}) with Gochara transits AND real dated life event cards that actually occurred. Calibrate how Dasha + Gochara + SAV/BAV physically manifested in real life.
- FOLD 3 (TARGET FUTURE WINDOW): The future window (${futureWindow.startMonth} to ${futureWindow.endMonth}) with Gochara transits and the user's specific questions.

CRITICAL OUTPUT SEPARATION RULE:
1. Main user-facing fields ("overallSynthesis", "verdictSummary", "timingWindow", "guidance"):
   - MUST read 100% as realistic, grounded, real-world scenarios, activities, and practical options that can manifest during ${futureWindow.startMonth} to ${futureWindow.endMonth}.
   - DO NOT mention astrology, planets, signs, houses, dasha, bhukti, gochara, transits, charts, nakshatras, yogas, or bindus in these four fields. Speak strictly in plain, realistic human terms.
2. Hidden breakdown field ("planetaryTriggers"):
   - Shown ONLY in a separate "Astrological Reasoning" inspection window when the user clicks to see why you arrived at those conclusions.
   - Here, explain the astrological reasoning VERY CLEARLY: cite exact Dasha-Bhukti-Antara, Moon-sign Gochara, house lordships, relevant divisional charts (D9, D10, D24, D60), SAV/BAV bindu strength, and how the past calibration event confirmed this pattern.`;

  const cardsSummary = cards
    .map(
      (c, idx) =>
        `CARD #${idx + 1} (id: ${c.id})
- Domain: ${c.domain}
- Past Event Title: ${c.title}
- Past Event Date: ${c.eventDate}
- Past Event Narrative: ${c.narrative}
- Future Question for ${futureWindow.startMonth} to ${futureWindow.endMonth}: ${
          c.question || 'Realistic possibilities and outlook for this domain in the future window.'
        }`
    )
    .join('\n\n');

  const userPrompt = `=== FOLD 1: NATAL DUMP ===
${natalDump}

=== FOLD 2: PAST NARRATIVE WINDOW (${narrativeWindow.startMonth} to ${narrativeWindow.endMonth}) ===
PAST TRANSITS:
${narrativeWindow.transitDump}

PAST EVENT CARDS & QUESTIONS:
${cardsSummary}

=== FOLD 3: FUTURE TRANSIT WINDOW (${futureWindow.startMonth} to ${futureWindow.endMonth}) ===
FUTURE TRANSITS:
${futureWindow.transitDump}

Return JSON strictly matching:
{
  "overallSynthesis": "2-3 sentence realistic, real-world synthesis of possibilities for the future period (ZERO astrology jargon)",
  "cardReadings": [
    {
      "cardId": "exact card id",
      "verdictSummary": "2-3 sentence realistic real-world scenario/possibilities answer (ZERO astrology jargon)",
      "planetaryTriggers": "Clear, detailed astrological reasoning explaining why: Dasha-Bhukti-Antara, Gochara transits, D-charts, SAV/BAV bindus, and calibration from the past event",
      "timingWindow": "realistic calendar timing inside the future window (no astrology jargon)",
      "guidance": "1-2 sentence practical, real-world next steps (ZERO astrology jargon)"
    }
  ]
}`;

  const fullCombinedPrompt = `=== SYSTEM INSTRUCTION ===
${systemInstruction}

=== USER PROMPT (FULL 3-FOLD DUMP) ===
${userPrompt}`;

  return { systemInstruction, userPrompt, fullCombinedPrompt };
}
