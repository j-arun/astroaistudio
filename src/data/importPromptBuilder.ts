import {
  BuildAnalyzePromptParams,
  buildAnalyzePromptParts,
  stripDateOfBirth,
} from './promptBuilder';

const UNWANTED_NOISE_LINE_REGEX =
  /^(?:end of (?:report|dump|data|chart|transits?|section|analysis|document)|begin (?:report|dump|data|chart)|report generated(?: on| at| by)?.*|generated (?:on|at|by|via).*|exported (?:on|at|from).*|printed (?:on|at).*|powered by.*|software version.*|page \d+(?:\s+of\s+\d+)?|confidential.*|disclaimer\s*:?.*|for informational purposes.*|for entertainment purposes.*|table of contents|horoscope report|vedic astrology report|astrology report|astrological data dump|birth chart report|birth details summary|general information|details|summary header|introduction|notes?\s*:?\s*(?:all calculations|ayanamsa note)?)$/i;

/**
 * Strips visual decorations, box borders, ASCII padding, blank spacer lines,
 * and unwanted chrome headings while preserving 100% of astrological and event data.
 */
export function condenseAstroDumpText(rawText: string): string {
  if (!rawText) return '';

  const piiStripped = stripDateOfBirth(rawText);
  const rawLines = piiStripped.split(/\r?\n/);
  const keptLines: string[] = [];

  for (const originalLine of rawLines) {
    let line = originalLine
      // Strip box-drawing borders and decorative Unicode glyphs
      .replace(/[┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬│┃║─━═]+/g, ' ')
      .replace(/^[ \t]*[•·▪▫►▸▶➤✦✧★☆🔮✨🌟📊📌🔹🔸◈❖]+/g, '')
      // Convert tabs and horizontal alignment padding to single spaces
      .replace(/[\t ]+/g, ' ')
      .trim();

    if (!line) continue;

    // Drop pure separator lines (====, ----, ****, ____, ~~~~, +++, ...)
    if (/^[=\-_*~#+.|:/\\]{2,}$/.test(line.replace(/\s+/g, ''))) {
      continue;
    }

    // Unwrap decorative heading framing: === HEADER ===, *** HEADER ***, ## HEADER
    line = line
      .replace(/^[=\-*~#]+\s+/, '')
      .replace(/\s+[=\-*~#]+$/, '')
      .replace(/\*\*/g, '')
      .replace(/\s+:/g, ':')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    if (!line) continue;

    // Drop boilerplate chrome lines only when they carry no numeric/astrological payload
    if (
      UNWANTED_NOISE_LINE_REGEX.test(line) &&
      !/\b(?:d\d+|sav|bav|dasha|bhukti|antara|gochara|lagna|rasi|nakshatra|moon|sun|mars|mercury|jupiter|venus|saturn|rahu|ketu)\b/i.test(
        line
      )
    ) {
      continue;
    }

    // Collapse duplicate consecutive identical lines (e.g. repeated page headers)
    if (keptLines.length > 0 && keptLines[keptLines.length - 1] === line) {
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n').trim();
}

export interface CondensedImportPromptResult {
  condensedPrompt: string;
  originalLength: number;
  condensedLength: number;
  savedPercent: number;
}

/**
 * Builds the condensed prompt for external LLMs (Claude / ChatGPT) used by the
 * "Import Card" copy button. Does NOT alter the Submit Card prompt (`buildAnalyzePromptParts`).
 */
export function buildCondensedImportPrompt(
  params: BuildAnalyzePromptParams
): CondensedImportPromptResult {
  const fullOriginal = buildAnalyzePromptParts(params).fullCombinedPrompt;

  const cleanNatal = condenseAstroDumpText(params.natalDump);
  const cleanPast = condenseAstroDumpText(params.narrativeWindow.transitDump || '');
  const cleanFuture = condenseAstroDumpText(params.futureWindow.transitDump || '');

  const cardsBlock = params.cards
    .map((c, idx) => {
      const q =
        c.question?.trim() ||
        'Realistic possibilities and outlook for this domain in the future window.';
      const cleanTitle = condenseAstroDumpText(c.title || '');
      const cleanNarrative = condenseAstroDumpText(c.narrative || '');
      return `Case ${idx + 1} [${c.domain}] ${c.eventDate}: ${cleanTitle} | Event: ${cleanNarrative} | Question: ${q}`;
    })
    .join('\n');

  const condensedPrompt = `Act as a master Jyotish analyst. Synthesize 3 datasets: Natal Baseline, Past Calibration (${params.narrativeWindow.startMonth}..${params.narrativeWindow.endMonth} transits + dated real-life event), and Future Window (${params.futureWindow.startMonth}..${params.futureWindow.endMonth} transits + question).

Rules:
1. Period Outlook, Realistic Outlook, Timing Window, Guidance: strictly plain real-world human scenarios and practical next steps (ZERO astrology terms).
2. Astrological Reasoning: cite exact Dasha-Bhukti-Antara, Moon-sign Gochara, house lordships, relevant D-charts (D9/D10/D24/D60), SAV/BAV bindus, and how the past event calibrated this pattern.
3. Format output cleanly with these exact Markdown headings so it imports cleanly:
## Overall Synthesis
## Realistic Outlook
## Timing Window
## Practical Guidance
## Astrological Reasoning

[NATAL]
${cleanNatal}

[PAST ${params.narrativeWindow.startMonth}..${params.narrativeWindow.endMonth}]
${cleanPast}
${cardsBlock}

[FUTURE ${params.futureWindow.startMonth}..${params.futureWindow.endMonth}]
${cleanFuture}`;

  const originalLength = fullOriginal.length;
  const condensedLength = condensedPrompt.length;
  const savedPercent =
    originalLength > 0
      ? Math.max(0, Math.round(((originalLength - condensedLength) / originalLength) * 100))
      : 0;

  return {
    condensedPrompt,
    originalLength,
    condensedLength,
    savedPercent,
  };
}
