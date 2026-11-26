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

export const ARUN_NATAL_DUMP = `PROFILE: Arun K. | DOB: 1994-05-14 | TOB: 06:42:18 IST | POB: Chennai, India (13.08N, 80.27E)
AYANAMSA: Lahiri (Chitrapaksha) 23°46'52"
LAGNA (ASCENDANT): Taurus (Vrishabha) 14°28'11" — Rohini Pada 2
JANMA RASI (MOON SIGN): Taurus (Vrishabha) 19°04'37" — Rohini Pada 3
SUN SIGN: Aries (Mesha) 29°12'04" — Krittika Pada 1 (Exalted)

--- D1 RASI CHART (PLANETARY LONGITUDES & HOUSES) ---
H1  Taurus (Vrishabha)   : Asc 14°28', Moon 19°04' (Exalted, Rohini), Ketu 23°18'
H2  Gemini (Mithuna)     : Empty [Lord Mercury in H12]
H3  Cancer (Kataka)      : Empty [Lord Moon in H1]
H4  Leo (Simha)          : Empty [Lord Sun in H12]
H5  Virgo (Kanya)        : Empty [Lord Mercury in H12]
H6  Libra (Tula)         : Jupiter (R) 16°44' (Swati-4)
H7  Scorpio (Vrishchika) : Rahu 23°18' (Jyeshtha-3)
H8  Sagittarius (Dhanu)  : Empty [Lord Jupiter in H6]
H9  Capricorn (Makara)   : Empty [Lord Saturn in H10]
H10 Aquarius (Kumbha)    : Saturn 17°19' (Moolatrikona, Satabhisha-4)
H11 Pisces (Meena)       : Mars 08°52' (Uttara Bhadrapada-2)
H12 Aries (Mesha)        : Sun 29°12' (Exalted), Mercury 11°05' (Ashwini-4), Venus 22°40' (Bharani-3)

--- CURRENT VIMSHOTTARI DASHA & BHUKTI TIMELINE ---
Maha Dasha : Jupiter (Guru) — 14 Sep 2018 to 14 Sep 2034 (16 Years)
Bhukti     : Saturn (Shani) — 08 Feb 2025 to 21 Aug 2027
Antara     : Mercury (Budha) — 19 Apr 2026 to 28 Aug 2026
Next Antara: Ketu — 28 Aug 2026 to 22 Oct 2026 | Venus (Shukra) — 22 Oct 2026 to 24 Mar 2027

--- DIVISIONAL CHARTS (D1 TO D144 SUMMARY) ---
D2 (Hora)        : Sun Hora (Asc, Ma, Sa), Moon Hora (Mo, Ju, Ve, Me) — Strong self-earned wealth capacity.
D3 (Drekkana)    : Lagna Leo; Mars in 3rd; Jupiter in 11th — Courageous initiatives & sibling/friend networks.
D4 (Chaturthamsa): Lagna Aquarius; Venus & Moon in 4th — Property stability & domestic comfort.
D7 (Saptamsa)    : Lagna Scorpio; 5th Lord Jupiter in 9th — Creative & progeny blessings.
D9 (Navamsa)     : Lagna Gemini; Moon in Gemini; Venus in Libra (Swakshetra); Saturn in Pisces; Jupiter in Aquarius; Mars in Virgo; Sun in Sagittarius. Vargottama Lagna strength in Venusian Navamsa.
D10 (Dasamsa)    : Lagna Capricorn; Saturn in 1st (Capricorn Swakshetra); Mars in 10th (Libra); Sun & Mercury in 4th; Jupiter in 11th — Strong long-term executive/analytical career arc; periodic restructuring during Saturn Bhukti.
D12 (Dwadasamsa) : Lagna Cancer; Moon in 10th — Strong maternal lineage support.
D16 (Shodasamsa) : Lagna Virgo; Venus in 2nd — Vehicles and comfort assets.
D20 (Vimsamsa)   : Lagna Pisces; Jupiter in 1st — Intuitive & dharmic focus.
D24 (Chaturvimsamsa): Lagna Leo; Mercury in 5th (Sagittarius); Jupiter in 9th (Aries) — High aptitude for analytical examinations, competitive testing, and late-period breakthroughs.
D27 (Bhamsa)     : Lagna Aries; Mars in 1st — Physical resilience.
D30 (Trimsamsa)  : Balanced malefic containment; Saturn in Capricorn Trimsamsa.
D40 (Khavedamsa) : Lagna Libra; Venus in 7th.
D45 (Akshavedamsa): Lagna Taurus; Moon in 1st.
D60 (Shashtiamsa): Lagna Sagittarius; Jupiter in 5th (Aries); Venus in 11th (Libra); Saturn in 3rd (Aquarius) — Past-life merit favors delayed-but-secure recovery and academic/career vindication.
D81 / D108 / D144: D144 Lagna Scorpio; 1st Lord Mars in 10th (Leo), Moon in 5th (Pisces), Jupiter in 9th (Cancer Exalted) — Deep Karmic Nadi alignment supports steady ascent after testing periods.

--- SARVASHTAKAVARGA (SAV) BINDUS BY SIGN (TOTAL 337) ---
Aries: 27 | Taurus: 33 | Gemini: 25 | Cancer: 29 | Leo: 24 | Virgo: 28
Libra: 31 | Scorpio: 26 | Sagittarius: 24 | Capricorn: 28 | Aquarius: 32 | Pisces: 30

--- BHINNASHTAKAVARGA (BAV) KEY HIGHLIGHTS ---
Moon BAV    : Taurus (6), Libra (5), Aquarius (5), Pisces (5) — High emotional & public reception in Taurus/Aquarius.
Jupiter BAV : Libra (5), Pisces (5), Taurus (6), Capricorn (4) — Guru transits over Gemini/Cancer/Leo modulate 2nd/3rd/4th from Moon.
Saturn BAV  : Aquarius (6), Pisces (4), Aries (3), Taurus (5) — Sade Sati / 11th-12th-1st transit sensitivity carefully buffered in Pisces (30 SAV, 4 BAV).
Venus BAV   : Taurus (6), Libra (6), Aries (4), Pisces (5) — Strong relational & financial recovery triggers when Venus transits Pisces/Taurus.
Mercury BAV : Aries (4), Taurus (5), Gemini (5), Aquarius (6) — Exam/communication spikes when Mercury connects to 2nd/5th/11th.`;

export const MEERA_NATAL_DUMP = `PROFILE: Meera S. | DOB: 1997-11-03 | TOB: 18:15:04 IST | POB: Bengaluru, India (12.97N, 77.59E)
AYANAMSA: Lahiri 23°49'38"
LAGNA (ASCENDANT): Aries (Mesha) 21°14'09" — Bharani Pada 3
JANMA RASI (MOON SIGN): Sagittarius (Dhanu) 07°41'22" — Moola Pada 3
SUN SIGN: Libra (Tula) 17°28'50" — Swati Pada 4 (Debilitated w/ Neechabhanga)

--- D1 RASI CHART ---
H1  Aries (Mesha)        : Saturn (R) 22°10'
H2  Taurus (Vrishabha)   : Empty
H3  Gemini (Mithuna)     : Empty
H4  Cancer (Kataka)      : Empty
H5  Leo (Simha)          : Rahu 25°14'
H6  Virgo (Kanya)        : Empty
H7  Libra (Tula)         : Sun 17°28', Mercury 26°04'
H8  Scorpio (Vrishchika) : Mars 14°33' (Swakshetra)
H9  Sagittarius (Dhanu)  : Moon 07°41', Venus 04°19'
H10 Capricorn (Makara)   : Jupiter 19°02' (Neechabhanga)
H11 Aquarius (Kumbha)    : Ketu 25°14'
H12 Pisces (Meena)       : Empty

--- CURRENT VIMSHOTTARI DASHA & BHUKTI ---
Maha Dasha : Rahu — 10 Mar 2021 to 10 Mar 2039 (18 Years)
Bhukti     : Saturn (Shani) — 14 Jan 2025 to 20 Nov 2027
Antara     : Venus (Shukra) — 11 Jun 2026 to 02 Dec 2026

--- DIVISIONAL CHARTS (D1 TO D144 SUMMARY) ---
D9 (Navamsa)     : Lagna Libra; Venus in 1st; Moon in Gemini; Mars in Aries; Jupiter in Pisces.
D10 (Dasamsa)    : Lagna Leo; Sun in 10th; Saturn in 6th — Creative leadership & international remote work.
D24 (Chaturvimsamsa): Lagna Gemini; Mercury in 1st — Research & design mastery.
D60 / D144       : D60 Lagna Pisces; Moon & Jupiter in 4th — Strong late-cycle turning points in partnerships and career.

--- SARVASHTAKAVARGA (SAV) BINDUS BY SIGN (TOTAL 337) ---
Aries: 26 | Taurus: 29 | Gemini: 27 | Cancer: 25 | Leo: 31 | Virgo: 28
Libra: 30 | Scorpio: 27 | Sagittarius: 32 | Capricorn: 29 | Aquarius: 28 | Pisces: 25

--- BHINNASHTAKAVARGA (BAV) KEY HIGHLIGHTS ---
Moon BAV    : Sagittarius (6), Aquarius (5), Leo (5)
Venus BAV   : Sagittarius (6), Libra (6), Capricorn (5)
Saturn BAV  : Aries (4), Pisces (4), Aquarius (5)`;

export const DEFAULT_PROFILES: AstroProfile[] = [
  {
    id: 'profile-arun',
    name: 'Arun K.',
    roleLabel: 'Primary Chart',
    natalDump: ARUN_NATAL_DUMP,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'profile-meera',
    name: 'Meera S.',
    roleLabel: 'Partner / Client',
    natalDump: MEERA_NATAL_DUMP,
    updatedAt: new Date().toISOString(),
  },
];

export function parseNatalDump(rawText: string, fallbackName = 'Profile'): ParsedNatalSummary {
  const lines = rawText.split('\n');
  const extractField = (regex: RegExp, def: string) => {
    const match = rawText.match(regex);
    return match?.[1]?.trim() || def;
  };

  const name = extractField(/PROFILE:\s*([^|\n]+)/i, fallbackName);
  const lagna = extractField(/LAGNA(?:\s*\(ASCENDANT\))?:\s*([^\n—]+)/i, 'Taurus (Vrishabha)');
  const moonSign = extractField(/JANMA RASI(?:\s*\(MOON SIGN\))?:\s*([^\n—]+)/i, 'Taurus (Vrishabha)');
  const nakshatra = extractField(/(?:JANMA RASI[^\n]*—\s*|NAKSHATRA:\s*)([^\n]+)/i, 'Rohini Pada 3');

  const maha = extractField(/Maha Dasha\s*:\s*([^\n(]+)/i, 'Jupiter');
  const bhukti = extractField(/Bhukti\s*:\s*([^\n(]+)/i, 'Saturn');
  const antara = extractField(/Antara\s*:\s*([^\n(]+)/i, 'Mercury');
  const currentDasha = `${maha.split('—')[0].trim()} MD · ${bhukti.split('—')[0].trim()} AD · ${antara.split('—')[0].trim()} PD`;

  // Parse SAV bindus
  const savDefaults = [27, 33, 25, 29, 24, 28, 31, 26, 24, 28, 32, 30];
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

  const savBindus = signKeys.map((s, idx) => {
    const m = rawText.match(new RegExp(`${s}\\s*:\\s*(\\d+)`, 'i'));
    return m ? parseInt(m[1], 10) : savDefaults[idx];
  });

  // Determine Lagna sign index
  let lagnaIndex = signKeys.findIndex((s) => lagna.toLowerCase().includes(s.toLowerCase()));
  if (lagnaIndex === -1) lagnaIndex = 1; // Taurus default

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

  // Extract divisional chart highlights
  const divisionalHighlights: Record<string, string> = {};
  const divCodes = ['D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D24', 'D60', 'D144'];
  for (const code of divCodes) {
    const m = rawText.match(new RegExp(`${code}[^:\\n]*:\\s*([^\\n]+)`, 'i'));
    if (m) {
      divisionalHighlights[code] = m[1].trim();
    }
  }
  if (!divisionalHighlights['D1']) {
    divisionalHighlights['D1'] = `${lagna} Lagna · ${moonSign} Moon · Full Rasi placements loaded`;
  }

  const savTotal = savBindus.reduce((acc, v) => acc + v, 0);

  const bavHighlights: Array<{ planet: string; sign: string; bindus: number }> = [];
  const bavRegex = /(Moon|Jupiter|Saturn|Venus|Mercury)\s+BAV\s*:\s*([^\n—]+)/gi;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = bavRegex.exec(rawText)) !== null) {
    const planet = bMatch[1];
    const firstPair = bMatch[2].match(/([A-Za-z]+)\s*\((\d+)\)/);
    if (firstPair) {
      bavHighlights.push({
        planet,
        sign: firstPair[1],
        bindus: parseInt(firstPair[2], 10),
      });
    }
  }

  return {
    name,
    lagna,
    moonSign,
    nakshatra,
    currentDasha,
    d1Houses,
    divisionalHighlights,
    savTotal,
    bavHighlights,
    tokenEstimate: Math.max(120, Math.round(rawText.length / 4)),
  };
}

export function buildSampleTransitDump(
  startMonth: string,
  endMonth: string,
  moonSign: string,
  isFuture: boolean
): string {
  const mode = isFuture ? 'FUTURE GOCHARA WINDOW' : 'PAST NARRATIVE GOCHARA WINDOW';
  if (isFuture) {
    return `${mode}: ${startMonth} to ${endMonth} (Anchored to Janma Rasi: ${moonSign})
- Saturn (Shani): Transiting Pisces (Meena) 11th house from Taurus Moon (4 BAV, 30 SAV) — strong karma-phala & debt/network resolution; direct motion accelerating pending financial/career dues.
- Jupiter (Guru): Transiting Cancer (Kataka) 3rd house (Exalted, aspecting 7th, 9th, 11th) — boosts interviews, exam result recovery, communication breakthroughs, and social reconnection.
- Rahu / Ketu Axis: Capricorn–Cancer / Aquarius–Leo transition — sudden reconnects via travel or study corridors; unexpected friend outreach around mid-window.
- Mars (Mangala): Transiting Capricorn -> Aquarius (9th & 10th from Moon) — assertive push on stalled applications and repayment conversations.
- Venus & Mercury: Rapid movement across 9th–11th houses — favorable conversational openings and clarity around relational/financial commitments.`;
  }
  return `${mode}: ${startMonth} to ${endMonth} (Anchored to Janma Rasi: ${moonSign})
- Saturn (Shani): Retrograde/Stationary in Pisces (11th from Taurus Moon) — delayed cashflow, temporary borrowing/obligations, heavy testing of patience.
- Jupiter (Guru): Transiting Gemini (2nd from Taurus Moon, Rohini/Mrigashira lord links) — mixed speech/finance expansion with scattered career focus.
- Rahu in Aquarius (10th from Moon) & Ketu in Leo (4th from Moon) — sudden job search pivots, restlessness at home, spontaneous social encounters.
- Mars & Mercury transits across Gemini–Cancer–Leo: High mental strain during competitive prep/exams and impulsive 5k short-term credit exchange.`;
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
        'Applied to 14 senior roles and reached two final interviews, but both went silent right when Saturn turned stationary.',
      question: 'Will one of these stalled tracks convert or will a new offer open up in this future window?',
    },
    {
      id: `card-${Date.now()}-2`,
      domain: 'Finance',
      title: 'Borrowed 5k from close friend',
      eventDate: clampDate(0, 21),
      narrative:
        'Needed short-term liquidity mid-month and borrowed 5,000 from a college friend with an informal timeline.',
      question: 'Will my friend ask for the 5k back during this future transit period, or is repayment pressure delayed?',
    },
    {
      id: `card-${Date.now()}-3`,
      domain: 'Love',
      title: 'Saw crush unexpectedly at bookstore cafe',
      eventDate: clampDate(1, 8),
      narrative:
        'Crossed paths with my crush near the station cafe; exchanged brief eye contact and two sentences before rushing off.',
      question: 'Will I see this crush again or get a natural conversation opening during this future window?',
    },
    {
      id: `card-${Date.now()}-4`,
      domain: 'Education',
      title: 'Wrote competitive certification exam',
      eventDate: clampDate(1, 24),
      narrative:
        'Sat for the 3-hour qualifying exam feeling prepared on theory, though time pressure hit hard in the final section.',
      question: 'How does my exam result look during this period—clear pass or borderline re-evaluation?',
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
