import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cpu,
  FileText,
  GitBranch,
  KeyRound,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  Waves,
  X,
} from 'lucide-react';
import {
  CardReading,
  MagicCard,
  TimelineDecisionFlow,
  TimelineStage,
} from '../types/astro';
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
}

function buildSmoothWavePath(points: Array<{ x: number; y: number }>): {
  linePath: string;
  areaPath: string;
} {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x} ${p.y}`,
      areaPath: `M ${p.x} 195 L ${p.x} ${p.y} L ${p.x} 195 Z`,
    };
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${d} L ${last.x} 195 L ${first.x} 195 Z`;
  return { linePath: d, areaPath };
}

function getDirectionBadge(direction: TimelineStage['direction']): {
  label: string;
  badgeClass: string;
  icon: 'pullback' | 'shift' | 'flow';
} {
  if (direction === 'pullback') {
    return {
      label: 'Pulled Back',
      badgeClass: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
      icon: 'pullback',
    };
  }
  if (direction === 'flow') {
    return {
      label: 'Flowing Forward',
      badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      icon: 'flow',
    };
  }
  return {
    label: 'Pivot / Shift',
    badgeClass: 'border-[#D4A853]/45 bg-[#D4A853]/15 text-[#F0C878]',
    icon: 'shift',
  };
}

function getRoleBadgeStyle(role: string): string {
  const lower = role.toLowerCase();
  if (lower.includes('key')) {
    return 'border-[#D4A853]/50 bg-[#D4A853]/15 text-[#F0C878]';
  }
  if (lower.includes('pull') || lower.includes('hold') || lower.includes('block')) {
    return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
  }
  if (lower.includes('flow') || lower.includes('catalyst') || lower.includes('open')) {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  }
  return 'border-sky-400/40 bg-sky-500/15 text-sky-200';
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
}) => {
  const [viewMode, setViewMode] = useState<'combined' | 'timeline' | 'text'>('combined');
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const flow: TimelineDecisionFlow | undefined = reading.timelineFlow;
  const stages = flow?.stages || [];

  useEffect(() => {
    if (!isOpen) return;
    setViewMode('combined');
    setActiveStageIdx(0);
    setIsPlaying(true);
  }, [isOpen, card.id, engineLabel]);

  useEffect(() => {
    if (!isOpen || viewMode === 'text' || !isPlaying || stages.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveStageIdx((prev) => (prev + 1) % stages.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isOpen, viewMode, isPlaying, stages.length]);

  if (!isOpen) return null;

  const DomainIcon = theme.icon;

  // Map stages onto SVG coordinate space
  const svgWidth = 720;
  const padX = 76;
  const usableW = svgWidth - padX * 2;
  const wavePoints = stages.map((stage, i) => {
    const ratio = stages.length > 1 ? i / (stages.length - 1) : 0.5;
    const x = padX + ratio * usableW;
    const y = 174 - (stage.flowScore / 100) * 136;
    return { x, y, stage };
  });

  const { linePath, areaPath } = buildSmoothWavePath(wavePoints);
  const activeStage = stages[activeStageIdx] || stages[0];
  const activePt = wavePoints[activeStageIdx] || wavePoints[0];

  const showVisualSection = viewMode === 'combined' || viewMode === 'timeline';
  const showTextSection = viewMode === 'combined' || viewMode === 'text';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/15 bg-[#141720] shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#11131A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-[#D4A853]/35 bg-[#D4A853]/10 flex items-center justify-center text-[#D4A853]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#EDEFF5]">
                Astrological Reasoning · {engineLabel}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8E95A5] mt-0.5">
                <span className={`inline-flex items-center gap-1 font-medium ${theme.accentText}`}>
                  <DomainIcon className="w-3 h-3" />
                  <span>{theme.label}</span>
                </span>
                <span>·</span>
                <span className="truncate max-w-[200px]">{card.title}</span>
                <span>·</span>
                <span className="tabular-nums">
                  {pastLabel} → {futureLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Filter Tabs (Default: Both Timeline + Text visible together) */}
            <div className="inline-flex rounded-lg border border-white/10 bg-[#191D28] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('combined')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'combined'
                    ? 'bg-[#D4A853] text-[#111318] font-semibold'
                    : 'text-[#8E95A5] hover:text-[#EDEFF5]'
                }`}
              >
                Timeline + Text
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-[#D4A853] text-[#111318] font-semibold'
                    : 'text-[#8E95A5] hover:text-[#EDEFF5]'
                }`}
              >
                <Waves className="w-3.5 h-3.5" />
                <span>Timeline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  viewMode === 'text'
                    ? 'bg-[#D4A853] text-[#111318] font-semibold'
                    : 'text-[#8E95A5] hover:text-[#EDEFF5]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Text Only</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8E95A5] hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close astrological reasoning window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* PRIVATE LLM TIMELINE DECISION SECTION */}
          {showVisualSection && (
            <div className="space-y-4">
              {flow && stages.length > 0 ? (
                <>
                  {/* Engine Provenance Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8E95A5]">
                    <span className="inline-flex items-center gap-1.5 text-[#D4A853]">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>
                        Timeline Decision Flow built by Private LLM (
                        {flow.generatedByModel || 'Ollama'}) from {engineLabel}&apos;s reasoning
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={isBuildingTimeline}
                      onClick={onRetryTimeline}
                      className="inline-flex items-center gap-1 text-[#8E95A5] hover:text-[#EDEFF5] disabled:opacity-40 transition-colors"
                    >
                      <RotateCw className={`w-3 h-3 ${isBuildingTimeline ? 'animate-spin' : ''}`} />
                      <span>Rebuild Timeline</span>
                    </button>
                  </div>

                  {/* 1. WHO HOLDS THE KEY */}
                  <div className="rounded-xl border border-[#D4A853]/35 bg-gradient-to-r from-[#D4A853]/[0.11] via-[#D4A853]/[0.04] to-transparent p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl border border-[#D4A853]/50 bg-[#D4A853]/15 flex items-center justify-center text-[#F0C878] shrink-0 mt-0.5">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4A853]">
                          Who Holds the Key
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="text-[11px] text-[#B9C0D0]">{flow.keyHolder.role}</span>
                      </div>
                      <div className="text-xs font-semibold text-[#EDEFF5]">
                        {flow.keyHolder.name}
                      </div>
                      <p className="text-xs text-[#C8CEDB] leading-relaxed">
                        {flow.keyHolder.why}
                      </p>
                    </div>
                  </div>

                  {/* 2. CONTINUOUS FLOWING WAVE CHART (PULLBACK VS FLOW TIMELINE) */}
                  <div className="rounded-2xl border border-white/10 bg-[#0F1219] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-[#EDEFF5] flex items-center gap-1.5">
                          <Waves className="w-3.5 h-3.5 text-[#D4A853]" />
                          <span>Decision Flow Over Time (Pulled Back vs. Flowing)</span>
                        </h4>
                        <p className="text-[11px] text-[#8E95A5]">
                          Click any milestone on the wave to inspect what pulled momentum back or opened the flow.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-[#EDEFF5] inline-flex items-center gap-1.5 transition-colors"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3 h-3 text-[#D4A853]" />
                            <span>Pause Wave</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-[#D4A853]" />
                            <span>Animate Wave</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative w-full">
                      <svg
                        viewBox={`0 0 ${svgWidth} 225`}
                        className="w-full h-auto overflow-visible select-none"
                      >
                        <defs>
                          <linearGradient id="tlWaveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#FB7185" stopOpacity="0.9" />
                            <stop offset="48%" stopColor="#D4A853" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#34D399" stopOpacity="0.95" />
                          </linearGradient>
                          <linearGradient id="tlWaveArea" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#D4A853" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#D4A853" stopOpacity="0.01" />
                          </linearGradient>
                          <filter id="tlGlowOrb" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Zones */}
                        <text x="14" y="42" fill="#6EE7B7" fontSize="10" opacity="0.8">
                          FLOWING
                        </text>
                        <line
                          x1="14"
                          y1="106"
                          x2={svgWidth - 14}
                          y2="106"
                          stroke="#ffffff"
                          strokeOpacity="0.12"
                          strokeDasharray="4 4"
                        />
                        <text x="14" y="101" fill="#9CA3AF" fontSize="9.5" opacity="0.7">
                          PIVOT THRESHOLD
                        </text>
                        <text x="14" y="180" fill="#FDA4AF" fontSize="10" opacity="0.8">
                          PULLED BACK
                        </text>

                        <motion.path
                          d={areaPath}
                          fill="url(#tlWaveArea)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.7 }}
                        />

                        <motion.path
                          d={linePath}
                          fill="none"
                          stroke="url(#tlWaveStroke)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.05, ease: 'easeInOut' }}
                        />

                        {activePt && (
                          <motion.circle
                            animate={{ cx: activePt.x, cy: activePt.y }}
                            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                            r="13"
                            fill="#D4A853"
                            fillOpacity="0.18"
                            filter="url(#tlGlowOrb)"
                          />
                        )}

                        {wavePoints.map((pt, idx) => {
                          const isSelected = idx === activeStageIdx;
                          const nodeColor =
                            pt.stage.direction === 'pullback'
                              ? '#FB7185'
                              : pt.stage.direction === 'flow'
                              ? '#34D399'
                              : '#D4A853';
                          return (
                            <g
                              key={`${pt.stage.phase}-${idx}`}
                              onClick={() => {
                                setIsPlaying(false);
                                setActiveStageIdx(idx);
                              }}
                              className="cursor-pointer"
                            >
                              <line
                                x1={pt.x}
                                y1={pt.y}
                                x2={pt.x}
                                y2={195}
                                stroke={isSelected ? nodeColor : '#ffffff'}
                                strokeOpacity={isSelected ? 0.5 : 0.1}
                                strokeDasharray="2 3"
                              />
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isSelected ? 7.5 : 5.5}
                                fill={isSelected ? nodeColor : '#181C26'}
                                stroke={isSelected ? '#FFF4D6' : nodeColor}
                                strokeWidth={isSelected ? 2.5 : 1.75}
                              />
                              <text
                                x={pt.x}
                                y={pt.y - 14}
                                textAnchor="middle"
                                fill={isSelected ? '#F6E3BA' : '#8E95A5'}
                                fontSize="10.5"
                                fontWeight={isSelected ? '600' : '500'}
                              >
                                {pt.stage.stateLabel}
                              </text>
                              <text
                                x={pt.x}
                                y={212}
                                textAnchor="middle"
                                fill={isSelected ? '#EDEFF5' : '#8E95A5'}
                                fontSize="11"
                                fontWeight={isSelected ? '600' : '400'}
                              >
                                {pt.stage.phase}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Active Stage Decision Details */}
                    {activeStage && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#D4A853]">
                              {activeStage.phase}
                            </span>
                            {activeStage.dateRange && (
                              <>
                                <span className="text-white/30">·</span>
                                <span className="text-[#B9C0D0] tabular-nums">
                                  {activeStage.dateRange}
                                </span>
                              </>
                            )}
                            {(() => {
                              const dBadge = getDirectionBadge(activeStage.direction);
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${dBadge.badgeClass}`}
                                >
                                  {dBadge.icon === 'pullback' ? (
                                    <ArrowDownRight className="w-3 h-3" />
                                  ) : dBadge.icon === 'flow' ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <RotateCw className="w-3 h-3" />
                                  )}
                                  <span>{dBadge.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <span className="text-[11px] tabular-nums text-[#8E95A5]">
                            Flow: {activeStage.flowScore}%
                          </span>
                        </div>
                        <div className="text-xs text-[#F0C878]">
                          <span className="text-[#8E95A5]">Decision Trigger: </span>
                          {activeStage.trigger}
                        </div>
                        <p className="text-xs text-[#D8DCE6] leading-relaxed">
                          {activeStage.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 3. PULLBACK & FLOW DRIVERS + CAUSAL TRANSITION CHAIN */}
                  {(flow.factors.length > 0 || flow.edges.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {flow.factors.length > 0 && (
                        <div className="lg:col-span-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                          <h4 className="text-xs font-semibold text-[#EDEFF5] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#D4A853]" />
                            <span>Pullback &amp; Flow Drivers</span>
                          </h4>
                          <div className="space-y-2">
                            {flow.factors.map((f, i) => (
                              <div
                                key={`${f.name}-${i}`}
                                className="rounded-lg border border-white/10 bg-[#11131A] p-2.5 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[#EDEFF5]">
                                    {f.name}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeStyle(
                                      f.role
                                    )}`}
                                  >
                                    {f.role}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#A1A8B8] leading-relaxed">
                                  {f.impact}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {flow.edges.length > 0 && (
                        <div
                          className={`${
                            flow.factors.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                          } rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5`}
                        >
                          <h4 className="text-xs font-semibold text-[#EDEFF5] flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-[#D4A853]" />
                            <span>How Transitions Shift Over Time</span>
                          </h4>
                          <div className="space-y-2">
                            {flow.edges.map((edge, i) => (
                              <div
                                key={`${edge.from}-${i}`}
                                className="rounded-lg border border-white/10 bg-[#11131A] p-3 space-y-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-semibold text-[#EDEFF5] px-2 py-0.5 rounded bg-white/[0.05] border border-white/10">
                                    {edge.from}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4A853]">
                                    <span>— {edge.relation}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </span>
                                  <span className="font-semibold text-[#F0C878] px-2 py-0.5 rounded bg-[#D4A853]/10 border border-[#D4A853]/30">
                                    {edge.to}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#B9C0D0] leading-relaxed">
                                  {edge.effect}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Private LLM Timeline Missing / Error / Building Fallback Banner */
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#EDEFF5] flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-[#D4A853]" />
                      <span>
                        {isBuildingTimeline
                          ? 'Private LLM is building the timeline decision flow...'
                          : 'Private LLM Timeline Decision Flow'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5]">
                      {timelineError
                        ? timelineError
                        : 'Click Generate Timeline to have your Private LLM (Ollama) map pullbacks and flows from the reasoning text below.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isBuildingTimeline}
                    onClick={onRetryTimeline}
                    className="px-3.5 py-1.5 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-45 text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isBuildingTimeline ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isBuildingTimeline ? 'Building...' : 'Build Timeline with Private LLM'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PROMINENT FULL REASONING TEXT SECTION (ALWAYS PRESERVED) */}
          {showTextSection && (
            <div className="space-y-3 pt-1">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#8E95A5]">
                  Question Evaluated
                </h4>
                <p className="text-xs font-medium leading-relaxed text-[#EDEFF5]">
                  {card.question}
                </p>
              </div>

              <div className="rounded-xl border border-[#D4A853]/35 bg-[#D4A853]/[0.06] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#D4A853]">
                    Full Astrological Reasoning Text ({engineLabel})
                  </h4>
                  {reading.timingWindow && (
                    <span className="text-[11px] font-medium tabular-nums text-[#D4A853]">
                      Peak Window: {reading.timingWindow}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[#E6E9F0] whitespace-pre-wrap">
                  {reading.planetaryTriggers ||
                    'No detailed astrological triggers returned for this card.'}
                </p>
              </div>

              {reading.verdictSummary && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-1.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#8E95A5]">
                    Corresponding Real-World Outlook
                  </h4>
                  <p className="text-xs leading-relaxed text-[#B9C0D0]">
                    {reading.verdictSummary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#11131A] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8E95A5]">
            Public prediction prompt stays untouched · Timeline analyzed separately by Private LLM
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
