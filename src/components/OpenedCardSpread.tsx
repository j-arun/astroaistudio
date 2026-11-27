import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarClock,
  Cpu,
  Layers,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AstroThread, GrahaTimelineData, LlmProvider } from '../types/astro';
import {
  MONTH_YEAR_OPTIONS,
  formatMonthRangeLabel,
  monthDiffInclusive,
} from '../data/sampleProfiles';
import { getCardTheme } from '../data/cardThemes';
import { AstroReasoningModal } from './AstroReasoningModal';

interface OpenedCardSpreadProps {
  thread: AstroThread;
  isSendingChat: boolean;
  chatError: string | null;
  onSendChat: (message: string, targetProvider?: LlmProvider) => void;
  onRetryChat: () => void;
  canRetryChat: boolean;
  isPostingToPrivateLlm: boolean;
  privateLlmError: string | null;
  onPostToPrivateLlm: () => void;
  onDeletePrivateReading: () => void;
  isUpdatingFutureWindow: boolean;
  futureWindowError: string | null;
  onUpdateFutureWindow: (startMonth: string, endMonth: string) => Promise<boolean>;
  isBuildingTimeline: boolean;
  timelineBuildError: string | null;
  onRetryTimelineBuild: (cardId?: string, sourceTab?: 'primary' | 'private') => void;
  onApplyManualTimelineJson?: (
    cardId: string,
    sourceTab: 'primary' | 'private',
    data: GrahaTimelineData
  ) => void;
}

export const OpenedCardSpread: React.FC<OpenedCardSpreadProps> = ({
  thread,
  isSendingChat,
  chatError,
  onSendChat,
  onRetryChat,
  canRetryChat,
  isPostingToPrivateLlm,
  privateLlmError,
  onPostToPrivateLlm,
  onDeletePrivateReading,
  isUpdatingFutureWindow,
  futureWindowError,
  onUpdateFutureWindow,
  isBuildingTimeline,
  timelineBuildError,
  onRetryTimelineBuild,
  onApplyManualTimelineJson,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'primary' | 'private'>('primary');
  const [draftMessage, setDraftMessage] = useState('');
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);

  // Follow-up Future Timeline editor state (only Future Target period can be changed, not Past Narrative)
  const [isEditingFuture, setIsEditingFuture] = useState(false);
  const [draftFutureStart, setDraftFutureStart] = useState(thread.futureWindow.startMonth);
  const [draftFutureEnd, setDraftFutureEnd] = useState(thread.futureWindow.endMonth);

  useEffect(() => {
    setSelectedIndex(0);
    setActiveTab('primary');
    setIsEditingFuture(false);
    setDraftFutureStart(thread.futureWindow.startMonth);
    setDraftFutureEnd(thread.futureWindow.endMonth);
  }, [thread.id]);

  useEffect(() => {
    setDraftFutureStart(thread.futureWindow.startMonth);
    setDraftFutureEnd(thread.futureWindow.endMonth);
  }, [thread.futureWindow.startMonth, thread.futureWindow.endMonth]);

  const pastLabel = formatMonthRangeLabel(
    thread.narrativeWindow.startMonth,
    thread.narrativeWindow.endMonth
  );
  const futureLabel = formatMonthRangeLabel(
    thread.futureWindow.startMonth,
    thread.futureWindow.endMonth
  );

  const primaryProvider: LlmProvider = thread.primaryProvider ?? 'gemini';
  const primaryTabLabel =
    primaryProvider === 'fable'
      ? 'Fable'
      : primaryProvider === 'ollama'
      ? 'Private LLM'
      : 'Gemini';

  const activeCard = thread.cards[selectedIndex] || thread.cards[0];
  const activeTheme = activeCard ? getCardTheme(activeCard.domain) : null;
  const ActiveDomainIcon = activeTheme?.icon;

  const hasPrivateResult = Boolean(
    thread.privateOverallSynthesis || thread.cards.some((c) => Boolean(c.privateReading))
  );
  const showTabs = hasPrivateResult || isPostingToPrivateLlm || Boolean(privateLlmError);

  // Show the small Private LLM icon ONLY when on primary non-Ollama tab and Private LLM has not yet been explored
  const showPrivateTriggerIcon =
    activeTab === 'primary' &&
    primaryProvider !== 'ollama' &&
    !hasPrivateResult &&
    !isPostingToPrivateLlm;

  const activeSynthesis =
    activeTab === 'private' ? thread.privateOverallSynthesis : thread.overallSynthesis;
  const activeReading =
    activeTab === 'private' ? activeCard?.privateReading : activeCard?.reading;

  const isLocalEngine =
    activeTab === 'private' || primaryProvider === 'ollama';
  const predictedModelName =
    activeTab === 'private'
      ? thread.privateModel ||
        activeReading?.grahaTimeline?.generatedByModel ||
        'Ollama'
      : thread.primaryModel ||
        activeReading?.grahaTimeline?.generatedByModel ||
        primaryTabLabel;

  const draftSpanMonths = monthDiffInclusive(draftFutureStart, draftFutureEnd);
  const isDraftFutureValid = draftSpanMonths >= 1 && draftSpanMonths <= 3;

  const handleTriggerPrivateLlm = () => {
    setActiveTab('private');
    onPostToPrivateLlm();
  };

  const handleDeletePrivate = () => {
    setActiveTab('primary');
    onDeletePrivateReading();
  };

  const handleApplyFutureTimeline = async () => {
    if (!isDraftFutureValid || isUpdatingFutureWindow) return;
    const ok = await onUpdateFutureWindow(draftFutureStart, draftFutureEnd);
    if (ok) {
      setIsEditingFuture(false);
    }
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed || isSendingChat) return;
    const targetProvider: LlmProvider =
      activeTab === 'private' ? 'ollama' : primaryProvider;
    onSendChat(trimmed, targetProvider);
    setDraftMessage('');
  };

  const lastUserMsgId = [...thread.messages]
    .reverse()
    .find((m) => m.role === 'user')?.id;

  return (
    <div className="space-y-6 pb-6">
      {/* Dual-Engine Tabs (Gemini vs Private LLM) shown once Private LLM is triggered/explored */}
      {showTabs && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('primary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                activeTab === 'primary'
                  ? 'bg-[#D4A853]/15 border-[#D4A853]/60 text-[#D4A853]'
                  : 'bg-white/[0.02] border-white/10 text-[#8E95A5] hover:text-[#EDEFF5] hover:bg-white/[0.05]'
              }`}
            >
              {primaryTabLabel}
            </button>

            <div className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab('private')}
                className={`px-3.5 py-1.5 text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                  hasPrivateResult && !isPostingToPrivateLlm ? 'rounded-l-lg border-r-0' : 'rounded-lg'
                } ${
                  activeTab === 'private'
                    ? 'bg-[#D4A853]/15 border-[#D4A853]/60 text-[#D4A853]'
                    : 'bg-white/[0.02] border-white/10 text-[#8E95A5] hover:text-[#EDEFF5] hover:bg-white/[0.05]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>
                  Private LLM{thread.privateModel ? ` · ${thread.privateModel}` : ''}
                </span>
              </button>

              {hasPrivateResult && !isPostingToPrivateLlm && (
                <button
                  type="button"
                  onClick={handleDeletePrivate}
                  title="Delete Private LLM response"
                  aria-label="Delete Private LLM response"
                  className={`px-2 py-1.5 rounded-r-lg border transition-colors inline-flex items-center ${
                    activeTab === 'private'
                      ? 'bg-[#D4A853]/15 border-[#D4A853]/60 text-[#D4A853]/80 hover:text-red-300 hover:bg-red-950/30'
                      : 'bg-white/[0.02] border-white/10 text-[#6C7384] hover:text-red-300 hover:bg-red-950/30'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <span className="text-[11px] font-mono text-[#6C7384] hidden sm:inline">
            Same 3-fold prompt · Dual comparison
          </span>
        </div>
      )}

      {/* Private LLM Pending / Error State on Private Tab */}
      {activeTab === 'private' && isPostingToPrivateLlm ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-10 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#D4A853]/40 bg-[#D4A853]/10 text-[#D4A853] mx-auto">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-[#EDEFF5]">
            Consulting Private LLM (Ollama)...
          </h3>
          <p className="text-xs text-[#8E95A5] max-w-md mx-auto leading-relaxed">
            Sending the exact same 3-fold prompt to your Ollama model for {pastLabel} →{' '}
            {futureLabel}.
          </p>
        </div>
      ) : activeTab === 'private' && privateLlmError && !hasPrivateResult ? (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/25 p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-red-200">
              Private LLM (Ollama) Request Failed
            </h3>
            <p className="text-xs text-red-300/90 leading-relaxed">{privateLlmError}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerPrivateLlm}
              className="px-3.5 py-1.5 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold transition-colors"
            >
              Retry Private LLM
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('primary')}
              className="px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#EDEFF5] transition-colors"
            >
              Back to {primaryTabLabel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Macro Realistic Outlook Header */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E95A5]">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-[#D4A853]">
                  {activeTab === 'private' ? 'Period Outlook · Private LLM' : 'Period Outlook'}
                </h2>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{pastLabel}</span>
                <ArrowRight className="w-3 h-3 text-[#6C7384]" />
                <span className="text-[#EDEFF5] font-medium tabular-nums">{futureLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {thread.cards.length} {thread.cards.length === 1 ? 'Card' : 'Cards'}
                </span>
              </div>

              <div
                title={`Predicted by ${predictedModelName}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#B9C0D0] whitespace-nowrap shrink-0 ml-auto"
              >
                {isLocalEngine ? (
                  <Cpu className="w-3.5 h-3.5 text-[#D4A853]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#D4A853]" />
                )}
                <span>{predictedModelName}</span>
              </div>
            </div>

            {activeSynthesis && (
              <p className="text-xs leading-relaxed text-[#D8DCE6]">{activeSynthesis}</p>
            )}
          </div>

          {/* Card Selector (legacy multi-card only) + Focused Real-World Reasoning Card */}
          {thread.cards.length > 0 && activeCard && activeTheme && ActiveDomainIcon && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Interactive Stacked Card Deck (only when multiple cards exist) */}
                {thread.cards.length > 1 && (
                  <div className="lg:col-span-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-[#8E95A5] px-1">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#EDEFF5]">
                        <Layers className="w-3.5 h-3.5 text-[#D4A853]" />
                        <span>Stacked Cards</span>
                      </h3>
                      <span className="text-[11px]">Click to inspect</span>
                    </div>

                    <div className="space-y-2.5">
                      {thread.cards.map((card, idx) => {
                        const isActive = idx === selectedIndex;
                        const cardTheme = getCardTheme(card.domain);
                        const CardIcon = cardTheme.icon;
                        return (
                          <motion.button
                            key={card.id}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            whileHover={{ x: isActive ? 0 : 4 }}
                            transition={{ duration: 0.16 }}
                            className={`w-full text-left relative overflow-hidden rounded-2xl p-3.5 border transition-all ${
                              cardTheme.surfaceGradient
                            } ${
                              isActive
                                ? cardTheme.activeBorderClass
                                : `${cardTheme.borderClass} opacity-80 hover:opacity-100`
                            } shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_28px_rgba(0,0,0,0.35)]`}
                            style={{ backgroundImage: cardTheme.ambientGlow }}
                          >
                            <div className="relative z-10 flex items-center justify-between text-[11px] mb-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 font-semibold ${cardTheme.accentText}`}
                              >
                                <CardIcon className="w-3.5 h-3.5" />
                                <span>{cardTheme.label}</span>
                              </span>
                              <span className="tabular-nums text-white/55">
                                {card.eventDate}
                              </span>
                            </div>
                            <div className="relative z-10 text-xs font-semibold text-[#EDEFF5] truncate">
                              {card.title}
                            </div>
                            <div className="relative z-10 text-xs leading-relaxed text-white/65 line-clamp-2 mt-1">
                              Q: {card.question}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Right / Full-Width: Active Card Real-World Scenario & Practical Guidance */}
                <div
                  className={`${
                    thread.cards.length > 1 ? 'lg:col-span-8' : 'lg:col-span-12'
                  } space-y-3`}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeCard.id}-${activeTab}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className={`relative overflow-hidden rounded-2xl border ${activeTheme.activeBorderClass} ${activeTheme.surfaceGradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_50px_rgba(0,0,0,0.45)] p-6 space-y-4`}
                      style={{ backgroundImage: activeTheme.ambientGlow }}
                    >
                      {/* Card Header */}
                      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5 text-xs">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold ${activeTheme.badgeClass}`}
                          >
                            <ActiveDomainIcon className="w-3.5 h-3.5" />
                            <span>{activeTheme.label}</span>
                          </span>
                          <span className={`text-[11px] font-medium ${activeTheme.mutedAccentText}`}>
                            {activeTheme.tagline}
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="text-[11px] tabular-nums text-white/65 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {activeCard.eventDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {activeReading?.timingWindow && (
                            <span
                              className={`text-[11px] font-medium tabular-nums ${activeTheme.accentText}`}
                            >
                              Window: {activeReading.timingWindow}
                            </span>
                          )}

                          {/* Small icon-only Private LLM trigger (hidden once Private LLM is explored) */}
                          {showPrivateTriggerIcon && (
                            <div className="relative group/priv">
                              <button
                                type="button"
                                onClick={handleTriggerPrivateLlm}
                                title="Post this question to private LLM."
                                aria-label="Post this question to private LLM."
                                className="p-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-[#D4A853]/20 hover:border-[#D4A853]/60 text-white/75 hover:text-[#D4A853] transition-colors flex items-center justify-center"
                              >
                                <Cpu className="w-3.5 h-3.5" />
                              </button>
                              <div
                                role="tooltip"
                                className="pointer-events-none opacity-0 group-hover/priv:opacity-100 transition-opacity duration-150 absolute top-full right-0 mt-1.5 z-30 whitespace-nowrap rounded-md border border-[#2D3240] bg-[#111318] px-2.5 py-1 text-[11px] font-medium text-[#EDEFF5] shadow-lg"
                              >
                                Post this question to private LLM.
                              </div>
                            </div>
                          )}

                          {/* Delete option at top of Private LLM card response */}
                          {activeTab === 'private' && hasPrivateResult && !isPostingToPrivateLlm && (
                            <button
                              type="button"
                              onClick={handleDeletePrivate}
                              title="Delete Private LLM response"
                              aria-label="Delete Private LLM response"
                              className="p-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-red-950/40 hover:border-red-900/60 text-white/70 hover:text-red-300 transition-colors flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Past Event Narrative */}
                      <div className="relative z-10 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-1">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                          Past Event
                        </h4>
                        <div className="text-xs font-semibold text-[#EDEFF5]">
                          {activeCard.title}
                        </div>
                        <p className="text-xs text-white/75 leading-relaxed">
                          {activeCard.narrative}
                        </p>
                      </div>

                      {/* Question Asked */}
                      <div className="relative z-10 space-y-1">
                        <h4
                          className={`text-[11px] font-semibold uppercase tracking-wider ${activeTheme.mutedAccentText}`}
                        >
                          Question
                        </h4>
                        <p className="text-xs font-medium text-[#EDEFF5] leading-relaxed">
                          {activeCard.question}
                        </p>
                      </div>

                      {/* Real-World Scenario Answer */}
                      {activeReading ? (
                        <div className="relative z-10 border-t border-white/10 pt-4 space-y-3">
                          <h4
                            className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${activeTheme.accentText}`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Realistic Outlook</span>
                          </h4>
                          <p className="text-xs leading-relaxed text-[#EDEFF5]">
                            {activeReading.verdictSummary}
                          </p>
                          <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-1">
                            <h4
                              className={`text-[11px] font-semibold uppercase tracking-wider ${activeTheme.accentText}`}
                            >
                              Practical Guidance
                            </h4>
                            <p className="text-xs text-white/80 leading-relaxed">
                              {activeReading.guidance}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="relative z-10 text-xs text-white/60">
                          No outlook attached to this card.
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Separate Astrological Reasoning Button Below the Reasoning Card (On-Demand Request 2 on Click) */}
                  {activeReading?.planetaryTriggers && (
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setReasoningModalOpen(true);
                          if (!activeReading.grahaTimeline && !isBuildingTimeline) {
                            onRetryTimelineBuild(activeCard.id, activeTab);
                          }
                        }}
                        title={
                          isBuildingTimeline
                            ? `${
                                activeTab === 'private' ? 'Private LLM' : primaryTabLabel
                              } is extracting Request 2 animation plot data...`
                            : activeReading.grahaTimeline
                            ? 'Open 2D Astrological Reasoning Timeline'
                            : 'Generate & Open 2D Astrological Reasoning Timeline'
                        }
                        className="px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-colors backdrop-blur-md border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-[#D4A853]"
                      >
                        {isBuildingTimeline ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Astrological Reasoning · Building Animation...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Astrological Reasoning — Why This Outlook</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Flowing Thread Follow-Up Conversation */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 space-y-4">
        <div className="border-b border-white/10 pb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#EDEFF5]">Follow-Up Questions</h3>

          <button
            type="button"
            onClick={() => setIsEditingFuture((v) => !v)}
            className="px-2.5 py-1 rounded-lg border border-[#D4A853]/35 bg-[#D4A853]/10 hover:bg-[#D4A853]/20 text-[11px] font-medium text-[#D4A853] inline-flex items-center gap-1.5 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Future: {futureLabel} · Change</span>
          </button>
        </div>

        {/* Editable Future Target Timeline */}
        {isEditingFuture && (
          <div className="rounded-xl border border-[#262A34] bg-[#14171E] p-4 space-y-3">
            <span className="block text-xs font-semibold text-[#EDEFF5]">
              Update Future Target Timeline (1–3 Months)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Future From
                </label>
                <select
                  value={draftFutureStart}
                  onChange={(e) => setDraftFutureStart(e.target.value)}
                  className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] outline-none"
                >
                  {MONTH_YEAR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Future To
                </label>
                <select
                  value={draftFutureEnd}
                  onChange={(e) => setDraftFutureEnd(e.target.value)}
                  className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] outline-none"
                >
                  {MONTH_YEAR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {futureWindowError && (
              <p className="text-xs text-red-400">{futureWindowError}</p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#262A34]">
              <span
                className={`text-xs font-mono tabular-nums ${
                  isDraftFutureValid ? 'text-[#8E95A5]' : 'text-red-400'
                }`}
              >
                {draftSpanMonths >= 1
                  ? `${draftSpanMonths} / 3 months`
                  : 'End must be >= Start'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingFuture(false);
                    setDraftFutureStart(thread.futureWindow.startMonth);
                    setDraftFutureEnd(thread.futureWindow.endMonth);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#262A34] text-xs text-[#B9C0D0] hover:text-[#EDEFF5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isDraftFutureValid || isUpdatingFutureWindow}
                  onClick={handleApplyFutureTimeline}
                  className="px-3.5 py-1.5 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold transition-colors"
                >
                  {isUpdatingFutureWindow ? 'Updating...' : 'Apply Timeline'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {thread.messages.length === 0 ? (
            <p className="text-xs text-[#8E95A5] py-1">
              Ask a follow-up about any realistic possibility, timing, or next step for your card.
            </p>
          ) : (
            thread.messages.map((msg) => {
              const msgProviderLabel =
                msg.provider === 'ollama'
                  ? 'Private LLM'
                  : msg.provider === 'fable'
                  ? 'Fable'
                  : msg.provider === 'gemini'
                  ? 'Gemini'
                  : 'Outlook Assistant';
              const isLastUserMsg = msg.role === 'user' && msg.id === lastUserMsgId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-xl px-4 py-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#262B38] text-[#EDEFF5] border border-[#353C4E]'
                        : 'bg-[#111318] text-[#D8DCE6] border border-[#262A34]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px] text-[#8E95A5] mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            msg.role === 'assistant'
                              ? 'text-[#D4A853] font-semibold'
                              : 'font-semibold'
                          }
                        >
                          {msg.role === 'user' ? 'You' : msgProviderLabel}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {isLastUserMsg && canRetryChat && !isSendingChat && (
                        <button
                          type="button"
                          onClick={onRetryChat}
                          title="Retry this follow-up question with full prompt"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4A853] hover:text-[#F0C878] transition-colors"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}

          {isSendingChat && (
            <div className="flex justify-start">
              <div className="bg-[#111318] border border-[#262A34] rounded-xl px-4 py-3 text-xs text-[#8E95A5]">
                Evaluating realistic scenarios for your follow-up...
              </div>
            </div>
          )}

          {chatError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3.5 py-2.5 text-xs text-red-300 flex flex-wrap items-center justify-between gap-3">
              <span className="flex-1 min-w-0">{chatError}</span>
              <button
                type="button"
                disabled={isSendingChat}
                onClick={onRetryChat}
                className="px-3 py-1.5 rounded-md bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmitChat} className="flex items-end gap-2 pt-2 border-t border-white/10">
          <textarea
            rows={2}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitChat(e);
              }
            }}
            placeholder={
              activeCard
                ? `Ask ${
                    activeTab === 'private' ? 'Private LLM' : primaryTabLabel
                  } a follow-up on ${activeCard.domain} (${futureLabel})...`
                : 'Ask a follow-up...'
            }
            className="flex-1 bg-white/[0.04] border border-white/10 focus:border-[#D4A853] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={!draftMessage.trim() || isSendingChat}
            className="px-4 py-2.5 h-[42px] bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 disabled:cursor-not-allowed text-[#111318] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* SEPARATE WINDOW: 2D GRAHA INFLUENCE TIMELINE & VERBATIM REASONING */}
      {activeCard && activeTheme && activeReading && (
        <AstroReasoningModal
          isOpen={reasoningModalOpen}
          onClose={() => setReasoningModalOpen(false)}
          card={activeCard}
          reading={activeReading}
          theme={activeTheme}
          engineLabel={activeTab === 'private' ? 'Private LLM' : primaryTabLabel}
          pastLabel={pastLabel}
          futureLabel={futureLabel}
          isBuildingTimeline={isBuildingTimeline}
          timelineError={timelineBuildError}
          onRetryTimeline={() => onRetryTimelineBuild(activeCard.id, activeTab)}
          onApplyManualJson={(data) =>
            onApplyManualTimelineJson?.(activeCard.id, activeTab, data)
          }
        />
      )}
    </div>
  );
};
