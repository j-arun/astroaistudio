import { stripDateOfBirth } from './promptBuilder.ts';

export interface GrahaExtractionPromptInput {
  domain: string;
  title: string;
  eventDate: string;
  narrative: string;
  question: string;
  pastStartMonth: string;
  pastEndMonth: string;
  futureStartMonth: string;
  futureEndMonth: string;
  natalDump?: string;
  pastTransitDump?: string;
  futureTransitDump?: string;
  verdictSummary: string;
  timingWindow: string;
  guidance?: string;
  planetaryTriggers: string;
}

export function getMonthWindowBounds(
  startMonth: string,
  endMonth: string
): { start: string; end: string } {
  const safeStart = /^\d{4}-\d{2}$/.test(startMonth) ? `${startMonth}-01` : '2026-01-01';
  if (/^\d{4}-\d{2}$/.test(endMonth)) {
    const [y, m] = endMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: safeStart,
      end: `${endMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return { start: safeStart, end: safeStart };
}

export function anonymizeAstroText(rawText: string): string {
  if (!rawText) return '';
  return stripDateOfBirth(rawText)
    .replace(/PROFILE:\s*[^\n|]+(\|[^\n]*)?/gi, 'PROFILE: [REDACTED]')
    .replace(
      /^(PERSON[ \t_-]*ID|PROFILE[ \t_-]*ID|NAME|FULL[ \t_-]*NAME|DATE[ \t_-]*OF[ \t_-]*BIRTH|DOB|BIRTH[ \t_-]*DATE|BIRTH[ \t_-]*PLACE|PLACE[ \t_-]*OF[ \t_-]*BIRTH|TIME[ \t_-]*OF[ \t_-]*BIRTH|BIRTH[ \t_-]*TIME|TOB|POB|LOCATION)\s*:.*$/gim,
      ''
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildGrahaTimelineExtractionPrompt(input: GrahaExtractionPromptInput): {
  systemInstruction: string;
  userPrompt: string;
  windowBounds: { start: string; end: string };
} {
  const windowBounds = getMonthWindowBounds(input.futureStartMonth, input.futureEndMonth);
  const anonymizedNatal = anonymizeAstroText(input.natalDump || '');
  const anonymizedPastTransits = anonymizeAstroText(input.pastTransitDump || '');
  const anonymizedFutureTransits = anonymizeAstroText(input.futureTransitDump || '');

  const systemInstruction = `You are converting your own astrological prediction and reasoning from Request 1 into exact day-by-day plot data for a 2D orbital timeline animation.
Do NOT add new astrology and do NOT change your earlier conclusion.
Audit your own stated dates, signs, retrograde windows, and durations against the chart/transit context when populating "review_flags".
Return ONLY one valid JSON object matching the exact schema requested, with zero markdown fences or extra commentary.
Strip any personal names, birth date, and birth place from all output fields.`;

  const userPrompt = `=== ORIGINAL CONTEXT GIVEN IN REQUEST 1 (ANONYMIZED) ===
${anonymizedNatal ? `NATAL CHART REFERENCE:\n${anonymizedNatal}\n\n` : ''}${
    anonymizedPastTransits
      ? `PAST WINDOW TRANSITS (${input.pastStartMonth} to ${input.pastEndMonth}):\n${anonymizedPastTransits}\n\n`
      : ''
  }PAST CALIBRATION EVENT (${input.eventDate}):
- Domain: ${input.domain}
- Event: ${input.title}
- Narrative: ${input.narrative}

TARGET QUESTION FOR FUTURE WINDOW (${windowBounds.start} to ${windowBounds.end}):
${input.question}

${
  anonymizedFutureTransits
    ? `FUTURE WINDOW TRANSITS (${windowBounds.start} to ${windowBounds.end}):\n${anonymizedFutureTransits}\n\n`
    : ''
}=== YOUR OWN REQUEST 1 PREDICTION & REASONING ===
Real-World Verdict Summary: ${input.verdictSummary}
Predicted Timing Window: ${input.timingWindow || `${windowBounds.start} to ${windowBounds.end}`}
${input.guidance ? `Practical Guidance: ${input.guidance}\n` : ''}Astrological Reasoning ("planetaryTriggers"):
${input.planetaryTriggers}

=== EXTRACTION TASK (REQUEST 2) ===
Now convert YOUR OWN reasoning above into plot data for an animation. Do not add new astrology and do not change your conclusion. Return ONLY one JSON object, no other text, in this exact shape:

{
  "title": "",
  "outcome_label": "<one or two words naming the predicted outcome>",
  "window": {"start": "${windowBounds.start}", "end": "${windowBounds.end}"},
  "dasha_line": "",
  "planets": [{"name": "", "role": "main pull | main friction | turning point | background controller | supporting"}],
  "retrograde": [{"planet": "", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD or omit"}],
  "links": [{"from": "", "to": "", "from_date": "YYYY-MM-DD"}],
  "factors": [
    {
      "planet": "",
      "polarity": "support | friction",
      "strength": 1 to 5,
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD",
      "tag": "2 to 3 words",
      "reasoning": "your own claim, one sentence",
      "why_strength": "why you rated it this strongly"
    }
  ],
  "review_flags": []
}

Rules:
- Include EVERY dated claim from your reasoning. Do not merge or skip.
- Set "window.start" to "${windowBounds.start}" and "window.end" to "${windowBounds.end}" (YYYY-MM-DD) covering the target future window, unless your reasoning explicitly requires a wider/exact span.
- "support" helps the predicted outcome, "friction" works against it.
- Strength 1 to 5 (integers or decimals like 1.5, 2.5, 4) = how much that factor drove your prediction (5 = decisive, 1 = minor background).
- Use only dates you stated or clearly implied, inside the window. If a date was only implied, say so in why_strength.
- Ensure "end" is never before "start", and all dates are valid YYYY-MM-DD.
- In "retrograde", omit "to" if the planet stays retrograde past the end of the window.
- In "review_flags", list any date, sign or duration in your own reasoning that you now doubt when cross-checked against the chart/transit dump above.
- Remove names, birth date and birth place.`;

  return { systemInstruction, userPrompt, windowBounds };
}
