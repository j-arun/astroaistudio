import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Upload,
  X,
} from 'lucide-react';
import { CardReading, GrahaTimelineData, MagicCard } from '../types/astro';
import { CardTheme } from '../data/cardThemes';

interface AstroReasoningModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: MagicCard;
  reading: CardReading;
  theme: CardTheme;
  engineLabel: string;
  pastLabel: string;
  futureLabel: string;
  isBuildingTimeline: boolean;
  timelineError: string | null;
  onRetryTimeline: () => void;
  onApplyManualJson?: (data: GrahaTimelineData) => void;
}

const TH = { p: 2, f: -3 };
const STATE_LABELS = [
  'Leans away from the outcome: friction, withdrawal or ambiguity',
  'Mixed signals, ambiguity',
  'Leans toward the outcome: pull, renewed attention',
] as const;

const DARK_PALETTE = {
  bg: 'rgba(13, 17, 25, 0.78)',
  card: 'rgba(255, 255, 255, 0.045)',
  fg: '#ece6dc',
  mut: '#a39a8e',
  ln: 'rgba(255, 255, 255, 0.12)',
  pos: '#5fcf8f',
  neg: '#ff7b6b',
  neu: '#9a9186',
  goldLn: 'rgba(212, 168, 83, 0.35)',
};

const LIGHT_PALETTE = {
  bg: 'rgba(255, 255, 255, 0.94)',
  card: 'rgba(15, 23, 42, 0.03)',
  fg: '#111827',
  mut: '#4B5563',
  ln: 'rgba(15, 23, 42, 0.12)',
  pos: '#0F8A4B',
  neg: '#C93B2B',
  neu: '#64748B',
  goldLn: 'rgba(180, 123, 30, 0.4)',
};

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isOkIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = parseIsoDate(s);
  const [y, m, d] = s.split('-').map(Number);
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

function validateGrahaJson(raw: unknown): GrahaTimelineData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON root must be an object.');
  }
  const D = raw as Record<string, unknown>;
  const win = D.window as Record<string, unknown> | undefined;
  if (!win || !isOkIsoDate(win.start) || !isOkIsoDate(win.end)) {
    throw new Error('window.start and window.end must be YYYY-MM-DD');
  }
  if (parseIsoDate(win.end) < parseIsoDate(win.start)) {
    throw new Error('window.end is before window.start');
  }
  if (!Array.isArray(D.factors) || D.factors.length === 0) {
    throw new Error('factors list is empty');
  }
  D.factors.forEach((item, i) => {
    const f = item as Record<string, unknown>;
    const prefix = `factor ${i + 1}: `;
    if (!f || typeof f.planet !== 'string' || !f.planet.trim()) {
      throw new Error(`${prefix}planet missing`);
    }
    if (f.polarity !== 'support' && f.polarity !== 'friction') {
      throw new Error(`${prefix}polarity must be support or friction`);
    }
    const str = Number(f.strength);
    if (!Number.isFinite(str) || str < 1 || str > 5) {
      throw new Error(`${prefix}strength must be 1 to 5`);
    }
    if (!isOkIsoDate(f.start) || !isOkIsoDate(f.end)) {
      throw new Error(`${prefix}start and end must be YYYY-MM-DD`);
    }
    if (parseIsoDate(f.end) < parseIsoDate(f.start)) {
      throw new Error(`${prefix}end is before start`);
    }
  });

  return raw as GrahaTimelineData;
}

interface NormalizedFactor {
  planet: string;
  weight: number; // +strength or -strength
  startIdx: number;
  endIdx: number;
  reasoning: string;
  tag: string;
  whyStrength: string;
  rawStrength: number;
}

interface ComputedEngineState {
  startDate: Date;
  totalDays: number;
  planets: string[];
  factors: NormalizedFactor[];
  retrograde: Record<string, [number, number]>;
  links: Array<[string, string, number]>;
  flags: string[];
  dailyNet: number[];
  title: string;
  outcomeLabel: string;
  dashaLine: string;
}

function buildEngineState(data: GrahaTimelineData): ComputedEngineState {
  const startDate = parseIsoDate(data.window.start);
  const di = (s: string) => Math.round((parseIsoDate(s).getTime() - startDate.getTime()) / 864e5);
  const totalDays = Math.max(1, di(data.window.end));
  const flags: string[] = [];

  const factors: NormalizedFactor[] = (data.factors || []).map((f) => {
    const a = di(f.start);
    const b = di(f.end);
    if (a < 0 || b > totalDays) {
      flags.push(`${f.planet} ${f.tag || f.start}: dates fall outside the window, clipped`);
    }
    const str = Number(f.strength);
    return {
      planet: f.planet,
      weight: (f.polarity === 'support' ? 1 : -1) * str,
      startIdx: Math.max(0, a),
      endIdx: Math.min(totalDays, b),
      reasoning: f.reasoning || '',
      tag: f.tag || '',
      whyStrength: f.why_strength || '',
      rawStrength: str,
    };
  });

  const planetNames = (data.planets || []).map((p) => p.name).filter(Boolean);
  factors.forEach((f) => {
    if (!planetNames.includes(f.planet)) {
      planetNames.push(f.planet);
    }
  });

  const retrograde: Record<string, [number, number]> = {};
  (data.retrograde || []).forEach((r) => {
    if (r.planet && isOkIsoDate(r.from)) {
      retrograde[r.planet] = [di(r.from), r.to && isOkIsoDate(r.to) ? di(r.to) : totalDays + 1];
    }
  });

  const links: Array<[string, string, number]> = (data.links || [])
    .filter((l) => l.from && l.to && isOkIsoDate(l.from_date))
    .map((l) => [l.from, l.to, di(l.from_date)]);

  const allFlags = flags.concat(data.review_flags || []);

  const dailyNet: number[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const sum = factors.reduce(
      (acc, f) => (i >= f.startIdx && i <= f.endIdx ? acc + f.weight : acc),
      0
    );
    dailyNet.push(sum);
  }

  return {
    startDate,
    totalDays,
    planets: planetNames,
    factors,
    retrograde,
    links,
    flags: allFlags,
    dailyNet,
    title: data.title || 'Graha influence timeline',
    outcomeLabel: data.outcome_label || 'Outcome',
    dashaLine: data.dasha_line || '',
  };
}

export const AstroReasoningModal: React.FC<AstroReasoningModalProps> = ({
  isOpen,
  onClose,
  card,
  reading,
  theme,
  engineLabel,
  pastLabel,
  futureLabel,
  isBuildingTimeline,
  timelineError,
  onRetryTimeline,
  onApplyManualJson,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'text'>('timeline');
  const [localOverrideData, setLocalOverrideData] = useState<GrahaTimelineData | null>(null);
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animTime, setAnimTime] = useState(0);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );

  // Load JSON modal dialog state
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  const sparkRef = useRef<SVGSVGElement | null>(null);
  const dayRef = useRef(day);
  dayRef.current = day;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const COL_BG = palette.bg;
  const COL_CARD = palette.card;
  const COL_FG = palette.fg;
  const COL_MUT = palette.mut;
  const COL_LN = palette.ln;
  const COL_POS = palette.pos;
  const COL_NEG = palette.neg;
  const COL_NEU = palette.neu;

  const activeData: GrahaTimelineData | undefined = localOverrideData || reading.grahaTimeline;

  const engine = useMemo(() => {
    if (!activeData || !activeData.factors?.length) return null;
    try {
      return buildEngineState(activeData);
    } catch {
      return null;
    }
  }, [activeData]);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      return;
    }
    setLocalOverrideData(null);
    setViewMode('timeline');
    setDay(0);
    setIsPlaying(false);
    setLoadModalOpen(false);
    setJsonError('');
  }, [isOpen, card.id, engineLabel]);

  // Reset cursor whenever new timeline data arrives
  useEffect(() => {
    if (engine) {
      setDay(0);
      setIsPlaying(false);
    }
  }, [engine]);

  // Continuous 60fps animation loop for pulse + 4 days/sec playback
  useEffect(() => {
    if (!isOpen || viewMode !== 'timeline' || !engine) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;
      setAnimTime(now);

      if (isPlaying) {
        const nextDay = dayRef.current + dtSec * 4;
        if (nextDay >= engine.totalDays) {
          dayRef.current = engine.totalDays;
          setDay(engine.totalDays);
          setIsPlaying(false);
        } else {
          dayRef.current = nextDay;
          setDay(nextDay);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, viewMode, engine, isPlaying]);

  if (!isOpen) return null;

  const DomainIcon = theme.icon;

  const handlePlayPause = () => {
    if (!engine) return;
    if (day >= engine.totalDays) {
      setDay(0);
      dayRef.current = 0;
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleOpenLoadJson = () => {
    setJsonError('');
    setJsonInput(activeData ? JSON.stringify(activeData, null, 2) : '');
    setLoadModalOpen(true);
  };

  const handleApplyJson = () => {
    try {
      const cleaned = jsonInput.replace(/```json|```/gi, '').trim();
      const raw = JSON.parse(cleaned);
      const valid = validateGrahaJson(raw);
      setLocalOverrideData(valid);
      onApplyManualJson?.(valid);
      setDay(0);
      setIsPlaying(false);
      setJsonError('');
      setLoadModalOpen(false);
    } catch (err: unknown) {
      setJsonError(
        `Could not read JSON: ${err instanceof Error ? err.message : 'Invalid format'}`
      );
    }
  };

  const scrubFromPointer = (clientX: number) => {
    if (!sparkRef.current || !engine) return;
    const rect = sparkRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const targetDay = ratio * engine.totalDays;
    dayRef.current = targetDay;
    setDay(targetDay);
  };

  // Compute day-specific drawing parameters matching reference HTML rules 1:1
  const pulse = 0.55 + 0.45 * Math.sin(animTime / 260);
  const CX = 300;
  const CY = 180;
  const R = 135;

  const activeFactors = engine
    ? engine.factors.filter((f) => day >= f.startIdx && day <= f.endIdx)
    : [];
  const netBalance = activeFactors.reduce((acc, f) => acc + f.weight, 0);
  const levelIdx = netBalance >= TH.p ? 2 : netBalance <= TH.f ? 0 : 1;
  const stateColor = [COL_NEG, COL_NEU, COL_POS][levelIdx];

  const isRetro = (planet: string, dVal: number) => {
    if (!engine) return false;
    const span = engine.retrograde[planet];
    return Boolean(span && dVal >= span[0] && dVal <= span[1]);
  };

  const planetPositions: Record<string, [number, number]> = {};
  if (engine && engine.planets.length > 0) {
    engine.planets.forEach((p, i) => {
      let ang = -Math.PI / 2 + (i * 2 * Math.PI) / engine.planets.length;
      if (isRetro(p, day)) {
        ang -= 0.0035 * (day - engine.retrograde[p][0]);
      }
      planetPositions[p] = [CX + R * 1.4 * Math.cos(ang), CY + R * Math.sin(ang)];
    });
  }

  const formattedCurrentDate = engine
    ? new Date(
        engine.startDate.getFullYear(),
        engine.startDate.getMonth(),
        engine.startDate.getDate() + Math.floor(day)
      ).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  // Sparkline coordinates
  const minV = engine ? Math.min(...engine.dailyNet, -1) : -1;
  const maxV = engine ? Math.max(...engine.dailyNet, 1) : 1;
  const mapY = (q: number) => 4 + ((maxV - q) / Math.max(0.0001, maxV - minV)) * 38;
  const sparkPoints = engine
    ? engine.dailyNet.map((q, i) => `${(i / engine.totalDays) * 600},${mapY(q)}`).join(' ')
    : '';

  const playButtonLabel =
    engine && day >= engine.totalDays ? 'Replay' : isPlaying ? 'Pause' : 'Play';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 dark:bg-black/65 backdrop-blur-md p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: COL_BG, color: COL_FG, borderColor: COL_LN }}
        className="w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col rounded-2xl border backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_28px_80px_rgba(15,23,42,0.22)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_28px_80px_rgba(0,0,0,0.68)] overflow-hidden"
      >
        {/* Top Modal Header */}
        <div
          style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
          className="px-4 py-2.5 border-b backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-4 h-4 text-[#9A6712] dark:text-[#D4A853] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#ece6dc] truncate">
                Astrological Reasoning · {engineLabel}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-[#a39a8e] truncate">
                <span className={`inline-flex items-center gap-1 font-medium ${theme.accentText}`}>
                  <DomainIcon className="w-3 h-3" />
                  <span>{theme.label}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[200px]">{card.title}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums whitespace-nowrap">
                  {pastLabel} → {futureLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Switch cleanly between 2D Graha Timeline Animation & Full Verbatim Text */}
            <div
              style={{ borderColor: COL_LN, backgroundColor: COL_BG }}
              className="inline-flex rounded-lg border p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-[#D4A853] text-[#111318] font-semibold'
                    : 'text-slate-600 dark:text-[#a39a8e] hover:text-[#111827] dark:hover:text-[#ece6dc]'
                }`}
              >
                2D Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                  viewMode === 'text'
                    ? 'bg-[#D4A853] text-[#111318] font-semibold'
                    : 'text-slate-600 dark:text-[#a39a8e] hover:text-[#111827] dark:hover:text-[#ece6dc]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Reasoning Text</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onRetryTimeline}
              disabled={isBuildingTimeline}
              title="Re-run Request 2 extraction on this engine"
              style={{ borderColor: COL_LN }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-[#111827] dark:text-[#ece6dc] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isBuildingTimeline ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Rebuild</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLoadJson}
              style={{ borderColor: COL_LN }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium text-[#111827] dark:text-[#ece6dc] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Load JSON</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-[#a39a8e] hover:text-[#111827] dark:hover:text-[#ece6dc] hover:bg-slate-900/[0.06] dark:hover:bg-white/5 transition-colors"
              aria-label="Close astrological reasoning window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        {viewMode === 'text' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {card.question && card.question.trim() && (
              <div
                style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
                className="rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-4 space-y-1.5"
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a39a8e]">
                  Question Evaluated
                </h4>
                <p className="text-xs font-medium leading-relaxed text-[#111827] dark:text-[#ece6dc]">{card.question}</p>
              </div>
            )}

            <div
              style={{ backgroundColor: COL_CARD, borderColor: palette.goldLn }}
              className="rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] p-5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9A6712] dark:text-[#D4A853]">
                  Why {engineLabel} Concluded This (Request 1 Reasoning)
                </h4>
                {reading.timingWindow && (
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-[#a39a8e]">
                    Window: {reading.timingWindow}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-[#111827] dark:text-[#ece6dc] whitespace-pre-wrap">
                {reading.planetaryTriggers || 'No detailed astrological reasoning returned.'}
              </p>
            </div>

            {reading.verdictSummary && (
              <div
                style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
                className="rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-4 space-y-1.5"
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a39a8e]">
                  Real-World Verdict
                </h4>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-[#a39a8e]">{reading.verdictSummary}</p>
              </div>
            )}
          </div>
        ) : engine ? (
          /* EXACT 3-LAYER SINGLE-SCREEN LAYOUT FROM REFERENCE HTML */
          <div className="flex-1 min-h-0 flex flex-col gap-2 p-2.5 overflow-hidden">
            {/* LAYER 1: Left = 2D Orbital SVG Map, Right = Reasoning Panel */}
            <div
              style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
              className="flex-1 min-h-0 rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-2.5 flex flex-col sm:flex-row gap-2.5 overflow-hidden"
            >
              {/* Left: 2D Planet Influence SVG Map */}
              <div className="flex-[1.2] sm:flex-[1.7] min-w-0 min-h-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 600 370"
                  role="img"
                  aria-label="Planet influence map"
                  className="w-full h-full max-h-full select-none"
                >
                  {/* Planet-to-centre force beams */}
                  {engine.planets.map((p) => {
                    const ev = activeFactors.filter((e) => e.planet === p);
                    const w = ev.reduce((x, e) => x + e.weight, 0);
                    const color = w > 0 ? COL_POS : w < 0 ? COL_NEG : COL_NEU;
                    const [x, y] = planetPositions[p] || [CX, CY];
                    if (ev.length > 0) {
                      return (
                        <line
                          key={`beam-${p}`}
                          x1={x}
                          y1={y}
                          x2={CX}
                          y2={CY}
                          stroke={color}
                          strokeWidth={1 + Math.min(6, Math.abs(w)) * 1.4}
                          opacity={pulse}
                          strokeDasharray={w < 0 ? '6 5' : undefined}
                        />
                      );
                    }
                    return (
                      <line
                        key={`beam-${p}`}
                        x1={x}
                        y1={y}
                        x2={CX}
                        y2={CY}
                        stroke={COL_LN}
                        strokeWidth={1}
                      />
                    );
                  })}

                  {/* Inter-planet Links active from from_date onward */}
                  {engine.links.map((l, idx) => {
                    if (day < l[2] || !planetPositions[l[0]] || !planetPositions[l[1]]) {
                      return null;
                    }
                    const [x1, y1] = planetPositions[l[0]];
                    const [x2, y2] = planetPositions[l[1]];
                    return (
                      <line
                        key={`link-${l[0]}-${l[1]}-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={COL_NEG}
                        strokeWidth={2}
                        opacity={pulse}
                      />
                    );
                  })}

                  {/* Central Outcome Node */}
                  <circle
                    cx={CX}
                    cy={CY}
                    r={34 + Math.min(12, Math.abs(netBalance)) * 2}
                    fill={stateColor}
                    opacity={0.18}
                  />
                  <circle
                    cx={CX}
                    cy={CY}
                    r={30}
                    fill="none"
                    stroke={stateColor}
                    strokeWidth={3}
                  />
                  <text
                    x={CX}
                    y={CY - 2}
                    textAnchor="middle"
                    fontSize={11}
                    fill={COL_FG}
                  >
                    {engine.outcomeLabel.slice(0, 12)}
                  </text>
                  <text
                    x={CX}
                    y={CY + 13}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill={COL_FG}
                    className="tabular-nums"
                  >
                    {netBalance > 0 ? `+${netBalance.toFixed(1)}` : netBalance.toFixed(1)}
                  </text>

                  {/* Planet Nodes */}
                  {engine.planets.map((p) => {
                    const ev = activeFactors.filter((e) => e.planet === p);
                    const w = ev.reduce((x, e) => x + e.weight, 0);
                    const color = w > 0 ? COL_POS : w < 0 ? COL_NEG : COL_NEU;
                    const [x, y] = planetPositions[p] || [CX, CY];
                    const r = 16 + Math.min(6, Math.abs(w)) * 3.5;
                    const tag = [...new Set(ev.map((e) => e.tag).filter(Boolean))].join(' · ');
                    const retro = isRetro(p, day);

                    return (
                      <g key={`node-${p}`}>
                        <circle cx={x} cy={y} r={r} fill={color} opacity={0.25} />
                        <circle
                          cx={x}
                          cy={y}
                          r={r}
                          fill="none"
                          stroke={color}
                          strokeWidth={2.5}
                        />
                        <text
                          x={x}
                          y={y + 4}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={600}
                          fill={COL_FG}
                        >
                          {p}
                          {retro ? ' ℞' : ''}
                        </text>
                        {tag && (
                          <text
                            x={x}
                            y={y + r + 13}
                            textAnchor="middle"
                            fontSize={10.5}
                            fill={color}
                          >
                            {tag}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Right: Reasoning Panel */}
              <div className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-2">
                <div>
                  <h4 className="text-[15px] font-semibold text-[#111827] dark:text-[#ece6dc] leading-snug">
                    {engine.title}
                  </h4>
                  {engine.dashaLine && (
                    <p className="text-[11px] text-slate-600 dark:text-[#a39a8e] mt-0.5">{engine.dashaLine}</p>
                  )}
                </div>

                <div
                  style={{ color: stateColor }}
                  className="text-[15px] font-semibold leading-snug"
                >
                  {STATE_LABELS[levelIdx]}
                </div>

                <ul className="space-y-1.5 pl-4 text-[13px] leading-snug">
                  {engine.flags.map((flag, idx) => (
                    <li
                      key={`flag-${idx}`}
                      className="list-none -ml-4 text-slate-600 dark:text-[#a39a8e] italic text-xs"
                    >
                      ⚑ {flag}
                    </li>
                  ))}

                  {activeFactors.length === 0 ? (
                    <li className="list-none -ml-4 text-xs text-slate-500 dark:text-[#a39a8e] italic">
                      No active transit factors inside this date interval.
                    </li>
                  ) : (
                    activeFactors.map((e, idx) => (
                      <li
                        key={`ev-${e.planet}-${idx}`}
                        style={{ color: e.weight > 0 ? COL_POS : COL_NEG }}
                        className="list-none -ml-4"
                      >
                        <div>
                          {e.weight > 0 ? '▲' : '▼'} {e.reasoning}
                        </div>
                        {e.whyStrength && (
                          <small className="block text-[11px] text-slate-600 dark:text-[#a39a8e] tabular-nums pl-3.5 mt-0.5">
                            strength {e.rawStrength}: {e.whyStrength}
                          </small>
                        )}
                      </li>
                    ))
                  )}
                </ul>

                <p className="text-[11px] text-slate-600 dark:text-[#a39a8e] pt-1 leading-relaxed">
                  Centre = outcome balance on this date: ▲ support minus ▼ friction. +2 or more
                  leans toward the outcome, −3 or less leans away. Green = support, red =
                  friction, dashed = friction line, thick = strong, ℞ = retrograde.
                </p>

                {/* Full Request 1 Reasoning Narrative preserved cleanly right below */}
                <div
                  style={{ borderColor: COL_LN }}
                  className="border-t pt-2.5 mt-2 space-y-1"
                >
                  <span className="block text-[11px] font-semibold text-[#9A6712] dark:text-[#D4A853]">
                    Full {engineLabel} Reasoning Text (Request 1)
                  </span>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-[#d7d0c4] whitespace-pre-wrap">
                    {reading.planetaryTriggers}
                  </p>
                </div>
              </div>
            </div>

            {/* LAYER 2: Thin Outcome Balance Sparkline Over Entire Window */}
            <div
              style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
              className="h-[54px] shrink-0 rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] px-2 py-1"
            >
              <svg
                ref={sparkRef}
                viewBox="0 0 600 46"
                preserveAspectRatio="none"
                role="img"
                aria-label="Outcome balance over time"
                onClick={(e) => scrubFromPointer(e.clientX)}
                className="w-full h-full block cursor-pointer"
              >
                <line
                  x1={0}
                  x2={600}
                  y1={mapY(0)}
                  y2={mapY(0)}
                  stroke={COL_LN}
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  fill="none"
                  stroke={COL_FG}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  points={sparkPoints}
                />
                <line
                  x1={(day / engine.totalDays) * 600}
                  x2={(day / engine.totalDays) * 600}
                  y1={0}
                  y2={46}
                  stroke={stateColor}
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* LAYER 3: Play / Pause / Replay + Slider + Date + Load JSON */}
            <div
              style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
              className="shrink-0 rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] px-3 py-2 flex items-center gap-2.5"
            >
              <button
                type="button"
                onClick={handlePlayPause}
                style={{ backgroundColor: COL_FG, color: COL_BG }}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition-opacity hover:opacity-90"
              >
                {playButtonLabel === 'Pause' ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : playButtonLabel === 'Replay' ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{playButtonLabel}</span>
              </button>

              <input
                type="range"
                min={0}
                max={engine.totalDays}
                step={0.01}
                value={day}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  dayRef.current = val;
                  setDay(val);
                }}
                aria-label="Date"
                className="flex-1 min-w-0 accent-[#B47B1E] dark:accent-[#D4A853] cursor-pointer"
              />

              <span className="min-w-[92px] text-right text-xs sm:text-sm font-semibold tabular-nums text-[#111827] dark:text-[#ece6dc] shrink-0">
                {formattedCurrentDate}
              </span>
            </div>
          </div>
        ) : (
          /* Fallback / Error / Loading state with full Request 1 Text still readable */
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <div
              style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
              className="rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-5 space-y-3"
            >
              {isBuildingTimeline ? (
                <div className="flex items-center gap-3 text-xs text-[#9A6712] dark:text-[#D4A853]">
                  <RotateCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>
                    {engineLabel} is converting its Request 1 reasoning into 2D timeline plot
                    data...
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-[#111827] dark:text-[#ece6dc]">
                        2D Timeline Graph Not Generated Yet
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-[#a39a8e] mt-0.5">
                        {timelineError ||
                          `Your Request 1 reasoning text is ready below. Press "Visualize 2D Graph" only if you want to send Request 2 to ${engineLabel} to plot the animation, or paste JSON via Load JSON.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onRetryTimeline}
                        className="px-3.5 py-1.5 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Visualize 2D Graph</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenLoadJson}
                        style={{ borderColor: COL_LN }}
                        className="px-3.5 py-1.5 rounded-lg border bg-white/80 dark:bg-white/[0.04] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] text-xs font-medium text-[#111827] dark:text-[#ece6dc]"
                      >
                        Load JSON
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div
              style={{ backgroundColor: COL_CARD, borderColor: COL_LN }}
              className="rounded-xl border backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-5 space-y-2"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9A6712] dark:text-[#D4A853]">
                Full {engineLabel} Reasoning Text (Request 1)
              </h4>
              <p className="text-xs leading-relaxed text-[#111827] dark:text-[#ece6dc] whitespace-pre-wrap">
                {reading.planetaryTriggers}
              </p>
            </div>
          </div>
        )}

        {/* Load JSON Dialog Overlay (exact validation rules from reference) */}
        {loadModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 dark:bg-black/65 backdrop-blur-md p-4"
            onClick={() => setLoadModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: COL_BG, borderColor: COL_LN }}
              className="w-full max-w-2xl rounded-2xl border backdrop-blur-2xl p-4 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_28px_80px_rgba(15,23,42,0.22)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_28px_80px_rgba(0,0,0,0.68)]"
            >
              <div className="flex items-center justify-between">
                <b className="text-sm text-[#111827] dark:text-[#ece6dc]">
                  Paste or inspect JSON from the Request 2 extraction step
                </b>
                <button
                  type="button"
                  onClick={() => setLoadModalOpen(false)}
                  className="p-1 rounded-lg text-slate-500 dark:text-[#a39a8e] hover:text-[#111827] dark:hover:text-[#ece6dc]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                spellCheck={false}
                style={{ borderColor: COL_LN }}
                className="w-full h-[44vh] rounded-lg border bg-slate-900/[0.03] dark:bg-white/[0.04] backdrop-blur-md p-3 text-xs font-mono text-[#111827] dark:text-[#ece6dc] leading-relaxed outline-none focus:border-[#B47B1E] dark:focus:border-[#D4A853]"
              />
              <div className="min-h-[16px] text-xs text-red-600 dark:text-[#ff7b6b]">{jsonError}</div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLoadModalOpen(false)}
                  style={{ borderColor: COL_LN }}
                  className="px-4 py-1.5 rounded-lg border text-xs font-medium text-[#111827] dark:text-[#ece6dc] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyJson}
                  style={{ backgroundColor: COL_FG, color: COL_BG }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
