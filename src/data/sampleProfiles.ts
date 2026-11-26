import { AstroProfile, HousePlacement, MagicCard, ParsedNatalSummary } from '../types/astro';

export const RASI_SIGNS = [
  'Aries (Mesha)',
  'Taurus (Vrishabha)',
  'Gemini (Mithuna)',
  'Cancer (Kataka)',
  'Leo (Simha)',
  'Virgo (Kanya)',
  'Libra (Tula)',
  'Scorpio (Vrishchika)',
  'Sagittarius (Dhanu)',
  'Capricorn (Makara)',
  'Aquarius (Kumbha)',
  'Pisces (Meena)',
];

export const SHORT_SIGNS = [
  'Ari',
  'Tau',
  'Gem',
  'Can',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sag',
  'Cap',
  'Aqu',
  'Pis',
];

export const DEFAULT_PROFILES: AstroProfile[] = [];

export function parseNatalDump(rawText: string, fallbackName = 'Profile'): ParsedNatalSummary {
  const lines = rawText.split('\n');
  const extractField = (regex: RegExp, def: string) => {
    const match = rawText.match(regex);
    return match?.[1]?.trim() || def;
  };

  const name = extractField(/PROFILE:\s*([^|\n]+)/i, fallbackName);
  const lagna = extractField(/LAGNA(?:\s*\(ASCENDANT\))?:\s*([^\n—]+)/i, 'Ascendant');
  const moonSign = extractField(/JANMA RASI(?:\s*\(MOON SIGN\))?:\s*([^\n—]+)/i, 'Moon Sign');
  const nakshatra = extractField(/(?:JANMA RASI[^\n]*—\s*|NAKSHATRA:\s*)([^\n]+)/i, '');

  const maha = extractField(/Maha Dasha\s*:\s*([^\n(]+)/i, '');
  const bhukti = extractField(/Bhukti\s*:\s*([^\n(]+)/i, '');
  const antara = extractField(/Antara\s*:\s*([^\n(]+)/i, '');
  const dashaParts = [maha, bhukti, antara]
    .map((s) => s.split('—')[0].trim())
    .filter(Boolean);
  const currentDasha = dashaParts.join(' · ') || 'Natal Dasha Loaded';

  const signKeys = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];

  const savBindus = signKeys.map((s) => {
    const m = rawText.match(new RegExp(`${s}\\s*:\\s*(\\d+)`, 'i'));
    return m ? parseInt(m[1], 10) : 28;
  });

  let lagnaIndex = signKeys.findIndex((s) => lagna.toLowerCase().includes(s.toLowerCase()));
  if (lagnaIndex === -1) lagnaIndex = 0;

  const planetMap: Record<number, string[]> = {};
  for (let i = 0; i < 12; i++) planetMap[i] = [];

  const planetShorts: Array<[RegExp, string]> = [
    [/\bSun\b/i, 'Su'],
    [/\bMoon\b/i, 'Mo'],
    [/\bMars\b/i, 'Ma'],
    [/\bMercury\b/i, 'Me'],
    [/\bJupiter\b/i, 'Ju'],
    [/\bVenus\b/i, 'Ve'],
    [/\bSaturn\b/i, 'Sa'],
    [/\bRahu\b/i, 'Ra'],
    [/\bKetu\b/i, 'Ke'],
  ];

  for (const line of lines) {
    const hMatch = line.match(/^H(\d{1,2})\s+([A-Za-z]+)/i);
    if (hMatch) {
      const signName = hMatch[2];
      const sIdx = signKeys.findIndex((s) => s.toLowerCase() === signName.toLowerCase());
      if (sIdx !== -1) {
        const rhs = line.split(':')[1] || '';
        if (!/empty/i.test(rhs)) {
          for (const [rx, code] of planetShorts) {
            if (rx.test(rhs) && !planetMap[sIdx].includes(code)) {
              const isRetro = new RegExp(`${rx.source}\\s*\\(R\\)`, 'i').test(rhs);
              planetMap[sIdx].push(isRetro ? `${code}(R)` : code);
            }
          }
        }
      }
    }
  }

  const d1Houses: HousePlacement[] = signKeys.map((sign, signIndex) => {
    const house = ((signIndex - lagnaIndex + 12) % 12) + 1;
    const planets = [...planetMap[signIndex]];
    if (signIndex === lagnaIndex) {
      planets.unshift('As');
    }
    return {
      sign,
      signIndex,
      house,
      planets,
      savBindus: savBindus[signIndex],
    };
  });

  const divisionalHighlights: Record<string, string> = {};
  const savTotal = savBindus.reduce((acc, v) => acc + v, 0);

  return {
    name,
    lagna,
    moonSign,
    nakshatra,
    currentDasha,
    d1Houses,
    divisionalHighlights,
    savTotal,
    bavHighlights: [],
    tokenEstimate: Math.max(0, Math.round(rawText.length / 4)),
  };
}

export function buildSampleTransitDump(
  startMonth: string,
  endMonth: string,
  moonSign: string,
  isFuture: boolean
): string {
  const mode = isFuture ? 'FUTURE GOCHARA WINDOW' : 'PAST NARRATIVE GOCHARA WINDOW';
  return `${mode}: ${startMonth} to ${endMonth} (Janma Rasi: ${moonSign})
Paste transit dump or click "Fetch Transit API" to load Gochara details for this range.`;
}

export function buildSampleCards(startMonth: string, endMonth: string): MagicCard[] {
  const [yr, mo] = startMonth.split('-').map(Number);
  const clampDate = (offsetMonths: number, day: number) => {
    const d = new Date(yr, mo - 1 + offsetMonths, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const candidate = `${yyyy}-${mm}`;
    if (candidate > endMonth) return `${endMonth}-${String(Math.min(day, 28)).padStart(2, '0')}`;
    return `${yyyy}-${mm}-${dd}`;
  };

  return [
    {
      id: `card-${Date.now()}-1`,
      domain: 'Career',
      title: 'Aggressive job search & final-round stall',
      eventDate: clampDate(0, 12),
      narrative:
        'Applied to senior roles and reached final interviews, which paused near the end of the month.',
      question: 'Will one of these stalled tracks convert or will a new offer open up in this future window?',
    },
    {
      id: `card-${Date.now()}-2`,
      domain: 'Finance',
      title: 'Borrowed 5k from close friend',
      eventDate: clampDate(0, 21),
      narrative:
        'Needed short-term liquidity mid-month and borrowed 5,000 from a friend with an informal timeline.',
      question: 'Will my friend ask for the 5k back during this future transit period?',
    },
  ];
}

export function monthDiffInclusive(startMonth: string, endMonth: string): number {
  if (!startMonth || !endMonth) return 0;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

export function formatMonthRangeLabel(startMonth: string, endMonth: string): string {
  const fmt = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  return startMonth === endMonth ? fmt(startMonth) : `${fmt(startMonth)} – ${fmt(endMonth)}`;
}

export function getMonthBounds(startMonth: string, endMonth: string): { minDate: string; maxDate: string } {
  const [ey, em] = endMonth.split('-').map(Number);
  const lastDay = new Date(ey, em, 0).getDate();
  return {
    minDate: `${startMonth}-01`,
    maxDate: `${endMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatYearMonthToLongLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function isValidPersonId(val: string): boolean {
  return /^[A-Za-z0-9]{5,7}$/.test(val.trim());
}
