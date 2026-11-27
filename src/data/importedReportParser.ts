import {
  AstroThread,
  CardDomain,
  CardReading,
  GrahaTimelineData,
  ImportedReportSection,
  ImportedSourceSystem,
  TransitWindow,
} from '../types/astro';

export type ImportFileFormat = 'md' | 'html' | 'txt' | 'json';

export interface ParseImportedReportOptions {
  fileName?: string;
  preferredSource?: ImportedSourceSystem | 'auto';
  customTitle?: string;
  profileId?: string;
  personId?: string;
  defaultNarrativeWindow?: TransitWindow;
  defaultFutureWindow?: TransitWindow;
}

export interface ParsedImportedReportResult {
  thread: AstroThread;
  detectedFormat: ImportFileFormat;
  detectedSource: ImportedSourceSystem;
  matchedFields: string[];
}

function repairJsonText(input: string): string {
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

  return out.replace(/,\s*([}\]])/g, '$1');
}

function extractBalancedJsonObjects(text: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
        } else {
          if (ch === '"') inString = true;
          else if (ch === '{') depth++;
          else if (ch === '}') {
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

function tryParseJsonObj(candidate: string): Record<string, unknown> | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  for (const attempt of [trimmed, repairJsonText(trimmed)]) {
    try {
      const val = JSON.parse(attempt);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return val as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }
  return null;
}

function collectCandidateJsonObjects(text: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const pushIfNew = (obj: Record<string, unknown> | null) => {
    if (!obj) return;
    const key = JSON.stringify(obj);
    if (!seen.has(key)) {
      seen.add(key);
      found.push(obj);
    }
  };

  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    pushIfNew(tryParseJsonObj(trimmed));
  }

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    pushIfNew(tryParseJsonObj(match[1]));
  }

  const balanced = extractBalancedJsonObjects(text).sort((a, b) => b.length - a.length);
  for (const rawObj of balanced) {
    pushIfNew(tryParseJsonObj(rawObj));
  }

  return found;
}

function detectFormat(rawContent: string, fileName?: string): ImportFileFormat {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'json') return 'json';
  if (ext === 'txt') return 'txt';

  const trimmed = rawContent.trim();
  if (
    /^<!doctype\s+html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed) ||
    (/<body[\s>]/i.test(trimmed) && /<\/(div|p|h1|h2|section|article)>/i.test(trimmed))
  ) {
    return 'html';
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return 'json';
  }
  if (/^#{1,6}\s+/m.test(trimmed) || /```/.test(trimmed) || /\*\*[^*]+\*\*/.test(trimmed)) {
    return 'md';
  }
  return 'txt';
}

function convertHtmlToStructuredMarkdown(html: string): {
  markdown: string;
  htmlTitle: string;
} {
  if (typeof DOMParser === 'undefined') {
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(h[1-6]|p|div|li|tr|section|article|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { markdown: stripped, htmlTitle: '' };
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const htmlTitle = (doc.title || '').trim();

  const noiseSelectors = 'script, style, noscript, svg, button, nav, footer';
  doc.querySelectorAll(noiseSelectors).forEach((el) => el.remove());

  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent || '';
      if (txt.trim()) {
        parts.push(txt.replace(/\s+/g, ' '));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(6, Math.max(1, Number(tag[1]) || 2));
      const headingText = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (headingText) {
        parts.push(`\n\n${'#'.repeat(level)} ${headingText}\n\n`);
      }
      return;
    }

    if (tag === 'pre') {
      const codeText = (el.textContent || '').trim();
      if (codeText) {
        parts.push(`\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`);
      }
      return;
    }

    if (tag === 'li') {
      const liText = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (liText) {
        parts.push(`\n- ${liText}`);
      }
      return;
    }

    if (tag === 'br') {
      parts.push('\n');
      return;
    }

    if (tag === 'strong' || tag === 'b') {
      const boldText = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (boldText) {
        parts.push(`**${boldText}**`);
      }
      return;
    }

    const isBlock = [
      'p',
      'div',
      'section',
      'article',
      'blockquote',
      'tr',
      'table',
      'ul',
      'ol',
      'hr',
    ].includes(tag);

    if (isBlock) parts.push('\n');
    Array.from(el.childNodes).forEach(walk);
    if (isBlock) parts.push('\n');
  };

  walk(doc.body || doc.documentElement);

  const markdown = parts
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { markdown, htmlTitle };
}

function detectSourceSystem(
  preferred: ImportedSourceSystem | 'auto' | undefined,
  fileName: string | undefined,
  text: string
): ImportedSourceSystem {
  if (preferred && preferred !== 'auto') return preferred;
  const probe = `${fileName || ''}\n${text.slice(0, 1200)}`.toLowerCase();
  if (/\b(claude|anthropic|sonnet|opus|haiku|fable)\b/.test(probe)) return 'claude';
  if (/\b(chatgpt|openai|gpt-4|gpt-5|gpt4|gpt5|o1|o3|o4)\b/.test(probe)) return 'chatgpt';
  if (/\b(gemini|google ai)\b/.test(probe)) return 'gemini';
  return 'other';
}

function cleanFileTitle(fileName?: string): string {
  if (!fileName) return '';
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferDomain(text: string): CardDomain {
  const lower = text.toLowerCase();
  if (/\b(career|job|promotion|workplace|business|profession|role|designation|d10)\b/.test(lower)) {
    return 'Career';
  }
  if (/\b(love|marriage|spouse|partner|relationship|romance|d9)\b/.test(lower)) {
    return 'Love';
  }
  if (/\b(finance|financial|money|wealth|income|investment|profit|salary|loan|debt)\b/.test(lower)) {
    return 'Financial';
  }
  if (/\b(health|medical|illness|vitality|recovery|hospital|stress)\b/.test(lower)) {
    return 'Health';
  }
  if (/\b(education|study|exam|university|degree|admission|d24)\b/.test(lower)) {
    return 'Education';
  }
  if (/\b(family|home|parents|mother|father|property|children)\b/.test(lower)) {
    return 'Family';
  }
  if (/\b(travel|relocation|abroad|visa|foreign|journey|move)\b/.test(lower)) {
    return 'Travel';
  }
  return 'Career';
}

function isGenericSectionHeading(heading: string): boolean {
  const h = heading.toLowerCase().trim();
  return /^(overall synthesis|period outlook|realistic outlook|verdict|verdict summary|timing window|timing|practical guidance|guidance|astrological reasoning|planetary triggers|summary|overview|conclusion|recommendations|next steps|response|report|analysis|prediction)$/.test(
    h
  );
}

interface RawMdSection {
  heading: string;
  level: number;
  content: string;
}

function splitMarkdownSections(markdown: string): {
  topTitle: string;
  preamble: string;
  sections: RawMdSection[];
} {
  // Strip fenced json code blocks after checking so headings inside code blocks don't split
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let topTitle = '';
  const preambleLines: string[] = [];
  const sections: RawMdSection[] = [];
  let current: RawMdSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      if (current) current.content += (current.content ? '\n' : '') + line;
      else preambleLines.push(line);
      continue;
    }

    if (!inFence) {
      const hMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const headingText = hMatch[2].replace(/\*\*/g, '').trim();
        if (level === 1 && !topTitle && !isGenericSectionHeading(headingText)) {
          topTitle = headingText;
          continue;
        }
        if (current) {
          current.content = current.content.trim();
          if (current.content) sections.push(current);
        }
        current = { heading: headingText, level, content: '' };
        continue;
      }

      // Support standalone bold section headings like **Overall Synthesis:** or **Practical Guidance**
      const boldMatch = trimmed.match(
        /^(?:[-*]\s+)?\*\*([A-Za-z][A-Za-z0-9 /&—–-]{2,55}?)\*\*[:\s]*(.*)$/
      );
      if (boldMatch) {
        const candidateHeading = boldMatch[1].replace(/:$/, '').trim();
        const trailingText = boldMatch[2].trim();
        if (
          /^(overall|period|realistic|verdict|timing|practical|guidance|advice|next steps|astrological|planetary|dasha|gochara|summary|overview|key dates|triggers|reasoning|why this)/i.test(
            candidateHeading
          )
        ) {
          if (current) {
            current.content = current.content.trim();
            if (current.content) sections.push(current);
          }
          current = { heading: candidateHeading, level: 2, content: trailingText };
          continue;
        }
      }
    }

    if (current) {
      current.content += (current.content ? '\n' : '') + line;
    } else {
      preambleLines.push(line);
    }
  }

  if (current) {
    current.content = current.content.trim();
    if (current.content) sections.push(current);
  }

  return {
    topTitle,
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

function classifyHeading(
  heading: string
): 'synthesis' | 'verdict' | 'timing' | 'guidance' | 'astrology' | 'other' {
  const h = heading.toLowerCase().trim();
  if (
    /overall synthesis|period outlook|executive summary|macro outlook|\bsynthesis\b|\boverview\b|\btl;?dr\b/.test(
      h
    )
  ) {
    return 'synthesis';
  }
  if (
    /astrological reasoning|planetary triggers|planetary|astrology|jyotish|dasha|gochara|transit|ashtakavarga|\bsav\b|\bbav\b|divisional|nakshatra|why this outlook|technical basis|chart basis/.test(
      h
    )
  ) {
    return 'astrology';
  }
  if (/timing window|key dates|calendar timing|\btiming\b|\btimeline\b|date range/.test(h)) {
    return 'timing';
  }
  if (/practical guidance|\bguidance\b|\badvice\b|recommendations|next steps|action plan|what to do/.test(h)) {
    return 'guidance';
  }
  if (
    /realistic outlook|verdict summary|\bverdict\b|\boutlook\b|scenario|possibilities|prediction|assessment|key findings|manifestation|forecast/.test(
      h
    )
  ) {
    return 'verdict';
  }
  return 'other';
}

function isValidGrahaTimelineCandidate(obj: Record<string, unknown>): boolean {
  const win = obj.window as Record<string, unknown> | undefined;
  return Boolean(
    win &&
      typeof win.start === 'string' &&
      typeof win.end === 'string' &&
      Array.isArray(obj.factors) &&
      obj.factors.length > 0
  );
}

function extractReadingJsonCandidate(
  objs: Record<string, unknown>[]
): Record<string, unknown> | null {
  for (const raw of objs) {
    let candidate = raw;
    if (
      !('cardReadings' in candidate) &&
      !('overallSynthesis' in candidate) &&
      !('verdictSummary' in candidate)
    ) {
      if (candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
        candidate = candidate.data as Record<string, unknown>;
      } else if (
        candidate.result &&
        typeof candidate.result === 'object' &&
        !Array.isArray(candidate.result)
      ) {
        candidate = candidate.result as Record<string, unknown>;
      }
    }
    if (
      'overallSynthesis' in candidate ||
      'cardReadings' in candidate ||
      'verdictSummary' in candidate ||
      'planetaryTriggers' in candidate
    ) {
      return candidate;
    }
  }
  return null;
}

function stripJsonCodeFences(text: string): string {
  return text.replace(/```(?:json)?[\s\S]*?```/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

function extractDetectedMonths(text: string): {
  pastStart?: string;
  pastEnd?: string;
  futureStart?: string;
  futureEnd?: string;
} {
  const matches = Array.from(
    text.matchAll(/\b(20\d{2}-\d{2})\s*(?:to|→|->|-|–|—)\s*(20\d{2}-\d{2})\b/gi)
  ).map((m) => [m[1], m[2]] as const);

  if (matches.length >= 2) {
    return {
      pastStart: matches[0][0],
      pastEnd: matches[0][1],
      futureStart: matches[1][0],
      futureEnd: matches[1][1],
    };
  }
  if (matches.length === 1) {
    return {
      futureStart: matches[0][0],
      futureEnd: matches[0][1],
    };
  }
  return {};
}

export function parseImportedReport(
  rawContent: string,
  options: ParseImportedReportOptions = {}
): ParsedImportedReportResult {
  const trimmedRaw = (rawContent || '').trim();
  if (!trimmedRaw) {
    throw new Error('The uploaded file is empty.');
  }

  const detectedFormat = detectFormat(trimmedRaw, options.fileName);
  let normalizedText = trimmedRaw;
  let htmlTitle = '';

  if (detectedFormat === 'html') {
    const converted = convertHtmlToStructuredMarkdown(trimmedRaw);
    normalizedText = converted.markdown || trimmedRaw;
    htmlTitle = converted.htmlTitle;
  }

  const detectedSource = detectSourceSystem(
    options.preferredSource,
    options.fileName,
    normalizedText
  );

  const jsonCandidates = collectCandidateJsonObjects(normalizedText);
  const readingJson = extractReadingJsonCandidate(jsonCandidates);
  const grahaCandidate = jsonCandidates.find(isValidGrahaTimelineCandidate) as
    | GrahaTimelineData
    | undefined;

  const asStr = (val: unknown): string => {
    if (typeof val === 'string') return val.trim();
    if (val && typeof val === 'object') return JSON.stringify(val, null, 2);
    return val !== undefined && val !== null ? String(val).trim() : '';
  };

  let overallSynthesis = '';
  let verdictSummary = '';
  let planetaryTriggers = '';
  let timingWindow = '';
  let guidance = '';
  let extraSections: ImportedReportSection[] = [];
  let mdTopTitle = '';

  const textWithoutFences = stripJsonCodeFences(normalizedText);
  const parsedMd = splitMarkdownSections(textWithoutFences || normalizedText);
  mdTopTitle = parsedMd.topTitle;

  if (readingJson) {
    const rawReadings = Array.isArray(readingJson.cardReadings)
      ? (readingJson.cardReadings as Array<Record<string, unknown>>)
      : Array.isArray(readingJson.cards)
      ? (readingJson.cards as Array<Record<string, unknown>>)
      : [];

    overallSynthesis = asStr(
      readingJson.overallSynthesis || readingJson.synthesis || readingJson.summary
    );

    if (rawReadings.length > 0) {
      verdictSummary = rawReadings
        .map((r) => asStr(r?.verdictSummary || r?.verdict || r?.summary))
        .filter(Boolean)
        .join('\n\n');
      planetaryTriggers = rawReadings
        .map((r) => asStr(r?.planetaryTriggers || r?.astrologicalReasoning || r?.reasoning))
        .filter(Boolean)
        .join('\n\n');
      timingWindow = rawReadings
        .map((r) => asStr(r?.timingWindow || r?.timing || r?.window))
        .filter(Boolean)
        .join(' · ');
      guidance = rawReadings
        .map((r) => asStr(r?.guidance || r?.advice || r?.nextSteps))
        .filter(Boolean)
        .join('\n\n');
    } else {
      verdictSummary = asStr(
        readingJson.verdictSummary || readingJson.verdict || readingJson.summary || overallSynthesis
      );
      planetaryTriggers = asStr(
        readingJson.planetaryTriggers || readingJson.astrologicalReasoning || readingJson.reasoning
      );
      timingWindow = asStr(readingJson.timingWindow || readingJson.timing);
      guidance = asStr(readingJson.guidance || readingJson.advice || readingJson.nextSteps);
    }

    // Preserve any Markdown narrative headings written outside the JSON fence
    if (parsedMd.sections.length > 0) {
      extraSections = parsedMd.sections
        .filter((s) => s.content.length > 0)
        .map((s) => ({ heading: s.heading, content: s.content }));
    }
  } else {
    const synthesisParts: string[] = [];
    const verdictParts: string[] = [];
    const timingParts: string[] = [];
    const guidanceParts: string[] = [];
    const astrologyParts: string[] = [];
    const unmatchedSections: ImportedReportSection[] = [];

    for (const sec of parsedMd.sections) {
      const kind = classifyHeading(sec.heading);
      if (kind === 'synthesis') synthesisParts.push(sec.content);
      else if (kind === 'verdict') verdictParts.push(sec.content);
      else if (kind === 'timing') timingParts.push(sec.content);
      else if (kind === 'guidance') guidanceParts.push(sec.content);
      else if (kind === 'astrology') astrologyParts.push(sec.content);
      else unmatchedSections.push({ heading: sec.heading, content: sec.content });
    }

    overallSynthesis = synthesisParts.join('\n\n').trim();
    verdictSummary = verdictParts.join('\n\n').trim();
    timingWindow = timingParts.join(' · ').replace(/\s+/g, ' ').trim();
    guidance = guidanceParts.join('\n\n').trim();
    planetaryTriggers = astrologyParts.join('\n\n').trim();
    extraSections = unmatchedSections;

    // Fallback when uploaded file has headings/paragraphs not matching standard names or plain prose
    const cleanPreamble = parsedMd.preamble.trim();
    if (!overallSynthesis && cleanPreamble) {
      const firstPara = cleanPreamble.split(/\n{2,}/)[0]?.trim() || '';
      if (firstPara && !firstPara.startsWith('{')) {
        overallSynthesis = firstPara.slice(0, 700);
      }
    }

    if (!verdictSummary) {
      if (unmatchedSections.length > 0) {
        const firstMain = unmatchedSections.shift()!;
        verdictSummary = firstMain.content;
        if (!overallSynthesis) {
          overallSynthesis = firstMain.content.split(/\n{2,}/)[0]?.slice(0, 500) || firstMain.heading;
        }
      } else if (cleanPreamble) {
        verdictSummary = cleanPreamble;
      } else if (overallSynthesis) {
        verdictSummary = overallSynthesis;
      } else {
        verdictSummary = textWithoutFences || normalizedText;
      }
    }

    if (!overallSynthesis && verdictSummary) {
      overallSynthesis = verdictSummary.split(/\n{2,}/)[0]?.slice(0, 500) || '';
    }
  }

  const matchedFields: string[] = [];
  if (overallSynthesis) matchedFields.push('Period Outlook');
  if (verdictSummary) matchedFields.push('Realistic Outlook');
  if (timingWindow) matchedFields.push('Timing');
  if (guidance) matchedFields.push('Guidance');
  if (planetaryTriggers) matchedFields.push('Astrological Reasoning');
  if (extraSections.length > 0) matchedFields.push(`${extraSections.length} Extra Sections`);
  if (grahaCandidate) matchedFields.push('2D Graha JSON');

  const cleanFile = cleanFileTitle(options.fileName);
  const resolvedTitle =
    options.customTitle?.trim() ||
    (readingJson ? asStr(readingJson.title) : '') ||
    mdTopTitle ||
    (htmlTitle && !isGenericSectionHeading(htmlTitle) ? htmlTitle : '') ||
    cleanFile ||
    'Imported Report';

  const sourceLabelMap: Record<ImportedSourceSystem, string> = {
    claude: 'Claude (Imported)',
    chatgpt: 'ChatGPT (Imported)',
    gemini: 'Gemini (Imported)',
    other: 'External Report',
  };

  const detectedMonths = extractDetectedMonths(normalizedText);
  const defaultPast = options.defaultNarrativeWindow || {
    startMonth: '2026-06',
    endMonth: '2026-08',
    transitDump: '',
  };
  const defaultFuture = options.defaultFutureWindow || {
    startMonth: '2027-01',
    endMonth: '2027-02',
    transitDump: '',
  };

  const reading: CardReading = {
    verdictSummary: verdictSummary || overallSynthesis || 'See imported report sections below.',
    planetaryTriggers,
    timingWindow,
    guidance,
    ...(grahaCandidate ? { grahaTimeline: grahaCandidate } : {}),
  };

  const inferredDomain = inferDomain(`${resolvedTitle}\n${verdictSummary}\n${planetaryTriggers}`);
  const nowIso = new Date().toISOString();

  const thread: AstroThread = {
    id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId: options.profileId || '',
    personId: options.personId || undefined,
    title: resolvedTitle,
    isCustomTitle: Boolean(options.customTitle?.trim()),
    isImported: true,
    importFormat: detectedFormat,
    importedFileName: options.fileName || undefined,
    importedSource: detectedSource,
    importedRawContent: trimmedRaw,
    importedSections: extraSections.length > 0 ? extraSections : undefined,
    createdAt: nowIso,
    submittedAt: nowIso,
    updatedAt: nowIso,
    step: 'reading',
    primaryProvider:
      detectedSource === 'claude' ? 'fable' : detectedSource === 'gemini' ? 'gemini' : undefined,
    primaryModel: sourceLabelMap[detectedSource],
    narrativeWindow: {
      ...defaultPast,
      startMonth: detectedMonths.pastStart || defaultPast.startMonth,
      endMonth: detectedMonths.pastEnd || defaultPast.endMonth,
    },
    futureWindow: {
      ...defaultFuture,
      startMonth: detectedMonths.futureStart || defaultFuture.startMonth,
      endMonth: detectedMonths.futureEnd || defaultFuture.endMonth,
    },
    cards: [
      {
        id: `imported-card-${Date.now()}`,
        domain: inferredDomain,
        title: resolvedTitle,
        eventDate: '',
        narrative: '',
        question: '',
        reading,
      },
    ],
    overallSynthesis,
    messages: [],
  };

  return {
    thread,
    detectedFormat,
    detectedSource,
    matchedFields,
  };
}
