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

export function stripDateOfBirth(rawText: string): string {
  if (!rawText) return '';

  // Remove bracketed birth profile / PII metadata section headers such as [BIRTH PROFILE & METADATA]
  const sectionHeaderRegex =
    /^[ \t]*\[[ \t]*(?:birth[ \t_-]*profile(?:[ \t]*(?:&|and)[ \t]*metadata)?|birth[ \t_-]*metadata|profile[ \t_-]*metadata|person[ \t_-]*metadata|birth[ \t_-]*details|personal[ \t_-]*(?:details|metadata|info))[ \t]*\][ \t]*(?:\r?\n|$)/gim;

  const sensitiveLabel = String.raw`(?:date[ \t_-]*of[ \t_-]*birth|birth[ \t_-]*date|d\.?[ \t]*o\.?[ \t]*b\.?|time[ \t_-]*of[ \t_-]*birth|birth[ \t_-]*time|t\.?[ \t]*o\.?[ \t]*b\.?|place[ \t_-]*of[ \t_-]*birth|birth[ \t_-]*(?:place|city|location|town|country)|p\.?[ \t]*o\.?[ \t]*b\.?|person[ \t_-]*id|profile[ \t_-]*id|user[ \t_-]*id|client[ \t_-]*id|subject[ \t_-]*id|reg(?:istration)?(?:[ \t._-]*(?:no|num|number|id))?\.?|(?:full[ \t_-]*|profile[ \t_-]*|person[ \t_-]*|user[ \t_-]*|client[ \t_-]*|native[ \t_-]*|subject[ \t_-]*)?name|profile|(?:current[ \t]+|native[ \t]+)?age(?:\s*\([^)\r\n]*\))?|place|location|coordinates|latitude|longitude|timezone|gender|sex|email|phone)`;
  const bornDate = String.raw`born(?:[ \t]+on)?[ \t]*[:=]?[ \t]*(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[ \t]+\d{1,2},?[ \t]+\d{2,4}|\d{1,2}[ \t]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[ \t]+\d{2,4})`;
  const parenAge = String.raw`(?:current[ \t]+)?age[ \t]*(?:[:=]|[ \t]+-[ \t]+|[ \t]+)\d+[^)\r\n]*`;

  return rawText
    .replace(sectionHeaderRegex, '')
    .replace(
      new RegExp(`[ \\t]*\\([ \\t]*(?:${sensitiveLabel}[ \\t]*(?:[:=]|[ \\t]+-[ \\t]+|[ \\t]+)[^)\\r\\n]+|${parenAge})\\)`, 'gi'),
      ''
    )
    .replace(
      new RegExp(`[|;·][ \\t]*${sensitiveLabel}[ \\t]*(?::|=|[ \\t]+-[ \\t]+)[^|;·\\r\\n]*(?=[ \\t]*[|;·])`, 'gi'),
      ''
    )
    .replace(
      new RegExp(`[ \\t]*[|;·][ \\t]*${sensitiveLabel}[ \\t]*(?::|=|[ \\t]+-[ \\t]+)[^|;·\\r\\n]*`, 'gi'),
      ''
    )
    .replace(
      new RegExp(`,[ \\t]*${sensitiveLabel}[ \\t]*(?::|=|[ \\t]+-[ \\t]+)[^|;·,\\r\\n]*(?=[ \\t]*,[ \\t]*[A-Za-z][A-Za-z0-9 ._-]*:)`, 'gi'),
      ''
    )
    .replace(
      new RegExp(`^([ \\t]*(?:[-*][ \\t]*)?)${sensitiveLabel}[ \\t]*(?::|=|[ \\t]+-[ \\t]+)[^|;·\\r\\n]*[ \\t]*[|;·][ \\t]*`, 'gim'),
      '$1'
    )
    .replace(
      new RegExp(`^([ \\t]*(?:[-*][ \\t]*)?)${sensitiveLabel}[ \\t]*(?::|=|[ \\t]+-[ \\t]+)[^|;·,\\r\\n]*[ \\t]*,[ \\t]*(?=[A-Za-z][A-Za-z0-9 ._-]*:)`, 'gim'),
      '$1'
    )
    .replace(
      new RegExp(`^[ \\t]*(?:[-*][ \\t]*)?(?:\\*\\*)?${sensitiveLabel}(?:\\*\\*)?[ \\t]*(?::|=|[ \\t]+-[ \\t]+).*?(?:\\r?\\n|$)`, 'gim'),
      ''
    )
    .replace(new RegExp(`[|;·,][ \\t]*${bornDate}(?=[ \\t]*[|;·,])`, 'gi'), '')
    .replace(new RegExp(`[ \\t]*[|;·,][ \\t]*${bornDate}`, 'gi'), '')
    .replace(new RegExp(`^[ \\t]*(?:[-*][ \\t]*)?${bornDate}[ \\t]*(?:[|;·,][ \\t]*|\\r?\\n|$)`, 'gim'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const stripPiiMetadata = stripDateOfBirth;

export function buildAnalyzePromptParts({
  natalDump,
  narrativeWindow,
  cards,
  futureWindow,
}: BuildAnalyzePromptParams): {
  systemInstruction: string;
  userPrompt: string;
  fullCombinedPrompt: string;
} {
  const cleanNatalDump = stripDateOfBirth(natalDump);
  const cleanPastTransitDump = stripDateOfBirth(narrativeWindow.transitDump || '');
  const cleanFutureTransitDump = stripDateOfBirth(futureWindow.transitDump || '');

  const systemInstruction = `You are a master Jyotish (Vedic astrology) analyst powering a real-world scenario foresight workspace for the user.
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
${cleanNatalDump}

=== FOLD 2: PAST NARRATIVE WINDOW (${narrativeWindow.startMonth} to ${narrativeWindow.endMonth}) ===
PAST TRANSITS:
${cleanPastTransitDump}

PAST EVENT CARDS & QUESTIONS:
${cardsSummary}

=== FOLD 3: FUTURE TRANSIT WINDOW (${futureWindow.startMonth} to ${futureWindow.endMonth}) ===
FUTURE TRANSITS:
${cleanFutureTransitDump}

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
