import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Layers,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CardDomain, MagicCard } from '../types/astro';
import {
  formatMonthRangeLabel,
  getMonthBounds,
} from '../data/sampleProfiles';
import { getCardTheme } from '../data/cardThemes';

export const MAX_MAGIC_CARDS = 1;

interface MagicCardDeckProps {
  startMonth: string;
  endMonth: string;
  isRangeValid: boolean;
  isFutureValid: boolean;
  isSubmitting: boolean;
  cards: MagicCard[];
  onChangeCards: (cards: MagicCard[]) => void;
  onDraftTitleChange?: (draftTitle: string) => void;
  onSubmitThread: () => void;
}

const DOMAINS: CardDomain[] = [
  'Love',
  'Career',
  'Financial',
  'Education',
  'Health',
  'Family',
  'Travel',
];

export const MagicCardDeck: React.FC<MagicCardDeckProps> = ({
  startMonth,
  endMonth,
  isRangeValid,
  isFutureValid,
  isSubmitting,
  cards,
  onChangeCards,
  onDraftTitleChange,
  onSubmitThread,
}) => {
  const bounds = isRangeValid
    ? getMonthBounds(startMonth, endMonth)
    : { minDate: '2026-01-01', maxDate: '2026-03-31' };
  const rangeLabel = isRangeValid
    ? formatMonthRangeLabel(startMonth, endMonth)
    : 'Invalid Month Range';

  const [isFlipped, setIsFlipped] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [domain, setDomain] = useState<CardDomain>('Love');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(bounds.minDate);
  const [narrative, setNarrative] = useState('');
  const [question, setQuestion] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMaxReached = cards.length >= MAX_MAGIC_CARDS && !editingId;
  const activeTheme = getCardTheme(domain);
  const ActiveDomainIcon = activeTheme.icon;

  useEffect(() => {
    if (!editingId && isRangeValid) {
      setEventDate((prev) => {
        if (!prev || prev < bounds.minDate || prev > bounds.maxDate) {
          return bounds.minDate;
        }
        return prev;
      });
    }
  }, [bounds.minDate, bounds.maxDate, editingId, isRangeValid]);

  const resetDraft = () => {
    setEditingId(null);
    setDomain('Love');
    setTitle('');
    setEventDate(bounds.minDate);
    setNarrative('');
    setQuestion('');
    setIsFlipped(false);
    setErrorMsg(null);
  };

  const validateTypedDate = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Type the event date (e.g., ' + bounds.minDate + ').';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && isRangeValid) {
      if (trimmed < bounds.minDate || trimmed > bounds.maxDate) {
        return `Date must fall inside ${rangeLabel} (${bounds.minDate} to ${bounds.maxDate}).`;
      }
    }
    return null;
  };

  const handleFlipToQuestion = () => {
    if (isMaxReached) {
      setErrorMsg(
        'Only 1 card is allowed per thread. Edit your card below or click Submit Card.'
      );
      return;
    }
    if (!title.trim() || !narrative.trim()) {
      setErrorMsg('Enter a subject name and brief narrative before flipping the card.');
      return;
    }
    const dateErr = validateTypedDate(eventDate);
    if (dateErr) {
      setErrorMsg(dateErr);
      return;
    }
    setErrorMsg(null);
    setIsFlipped(true);
  };

  const handlePushToTray = () => {
    if (isMaxReached) {
      setErrorMsg('Only 1 card is allowed per thread.');
      return;
    }
    if (!title.trim() || !narrative.trim()) {
      setErrorMsg('Front event details are required.');
      setIsFlipped(false);
      return;
    }
    const dateErr = validateTypedDate(eventDate);
    if (dateErr) {
      setErrorMsg(dateErr);
      setIsFlipped(false);
      return;
    }
    if (!question.trim()) {
      setErrorMsg('Write the question on the back of this card before adding to stack.');
      return;
    }

    const nextCard: MagicCard = {
      id: editingId || `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      domain,
      title: title.trim(),
      eventDate: eventDate.trim(),
      narrative: narrative.trim(),
      question: question.trim(),
    };

    if (editingId) {
      onChangeCards(cards.map((c) => (c.id === editingId ? nextCard : c)));
    } else {
      onChangeCards([...cards, nextCard]);
    }
    resetDraft();
  };

  const handleEditFromTray = (card: MagicCard) => {
    setEditingId(card.id);
    setDomain(card.domain === 'Finance' ? 'Financial' : card.domain);
    setTitle(card.title);
    setEventDate(card.eventDate);
    setNarrative(card.narrative);
    setQuestion(card.question);
    setIsFlipped(false);
    setErrorMsg(null);
  };

  const handleRemoveFromTray = (id: string) => {
    onChangeCards(cards.filter((c) => c.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#EDEFF5] tracking-tight">
            Magic Card · 1 Card Per Thread
          </h2>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Choose a life theme, record what occurred ({bounds.minDate} to {bounds.maxDate}), flip to ask one focused question, and submit your card.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#D4A853]">
          {cards.length} / {MAX_MAGIC_CARDS} card
        </span>
      </div>

      {/* 3D Flippable Translucent Glass Magic Card Builder */}
      {isMaxReached ? (
        <div className="max-w-2xl mx-auto rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_40px_rgba(0,0,0,0.4)] p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-[#EDEFF5]">
            1 / 1 Magic Card Ready
          </p>
          <p className="text-xs text-[#8E95A5]">
            One focused card is staged for this thread. Click the card below to edit it, or click{' '}
            <span className="text-[#D4A853] font-medium">Submit Card</span>.
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="perspective-1200">
            <div
              className={`relative w-full transition-transform duration-500 preserve-3d ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{ minHeight: '352px' }}
            >
              {/* FRONT FACE — TRANSLUCENT DOMAIN-THEMED GLASS CARD */}
              <div
                className={`relative w-full overflow-hidden rounded-2xl border ${activeTheme.borderClass} ${activeTheme.surfaceGradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_50px_rgba(0,0,0,0.45)] p-5 backface-hidden flex flex-col justify-between transition-colors duration-300 ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
                style={{ backgroundImage: activeTheme.ambientGlow }}
              >
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${activeTheme.badgeClass}`}
                      >
                        <ActiveDomainIcon className="w-3.5 h-3.5" />
                        <span>{activeTheme.label}</span>
                      </span>
                      <span className={`text-[11px] font-medium ${activeTheme.mutedAccentText}`}>
                        {activeTheme.tagline}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetDraft}
                          className="text-xs text-white/60 hover:text-white transition-colors"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <span className="text-[11px] font-mono uppercase tracking-wider text-white/45">
                        Front
                      </span>
                    </div>
                  </div>

                  {/* Domain Theme Selector */}
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-white/60 mb-2">
                      Card Theme
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DOMAINS.map((d) => {
                        const dTheme = getCardTheme(d);
                        const DIcon = dTheme.icon;
                        const selected =
                          domain === d || (domain === 'Finance' && d === 'Financial');
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDomain(d)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                              selected
                                ? dTheme.selectorActiveClass
                                : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.07] hover:text-white'
                            }`}
                          >
                            <DIcon className="w-3 h-3" />
                            <span>{dTheme.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title + Typed Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-white/70 mb-1.5">
                        Subject Name
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setTitle(nextVal);
                          onDraftTitleChange?.(nextVal);
                        }}
                        placeholder="e.g., Saw crush at cafe / Bonus approval / Exam"
                        className={`w-full bg-white/[0.04] backdrop-blur-md border border-white/10 ${activeTheme.focusBorderClass} rounded-lg px-3 py-2 text-xs text-[#EDEFF5] placeholder-white/30 outline-none transition-colors`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1.5">
                        Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className={`w-full bg-white/[0.04] backdrop-blur-md border border-white/10 ${activeTheme.focusBorderClass} rounded-lg px-3 py-2 text-xs tabular-nums text-[#EDEFF5] placeholder-white/30 outline-none transition-colors`}
                      />
                    </div>
                  </div>

                  {/* Narrative Details */}
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      What Happened
                    </label>
                    <textarea
                      rows={3}
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                      placeholder="Describe what happened during this past period..."
                      className={`w-full bg-white/[0.04] backdrop-blur-md border border-white/10 ${activeTheme.focusBorderClass} rounded-lg px-3 py-2 text-xs leading-relaxed text-[#EDEFF5] placeholder-white/30 outline-none transition-colors resize-none`}
                    />
                  </div>

                  {errorMsg && !isFlipped && <p className="text-xs text-red-300">{errorMsg}</p>}
                </div>

                <div className="relative z-10 flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                  <span className="text-[11px] font-mono text-white/45">
                    {bounds.minDate} .. {bounds.maxDate}
                  </span>
                  <button
                    type="button"
                    onClick={handleFlipToQuestion}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm ${activeTheme.buttonClass}`}
                  >
                    <span>Flip Card for Question</span>
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* BACK FACE — QUESTION SIDE (SAME TRANSLUCENT THEME) */}
              <div
                className={`absolute inset-0 w-full overflow-hidden rounded-2xl border ${activeTheme.activeBorderClass} ${activeTheme.backSurfaceGradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_20px_50px_rgba(0,0,0,0.48)] p-5 backface-hidden rotate-y-180 flex flex-col justify-between ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
                style={{ backgroundImage: activeTheme.ambientGlow }}
              >
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${activeTheme.badgeClass}`}
                      >
                        <ActiveDomainIcon className="w-3.5 h-3.5" />
                        <span>{activeTheme.label}</span>
                      </span>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                        Back · Question
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(false)}
                      className="text-xs text-white/75 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Flip to Front
                    </button>
                  </div>

                  <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className={`font-medium ${activeTheme.accentText}`}>
                        {activeTheme.label}
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{eventDate}</span>
                    </div>
                    <p className="text-xs font-semibold text-[#EDEFF5] mt-0.5 truncate">
                      {title || 'Untitled Event'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/85 mb-1.5">
                      Question for the Future Target Period
                    </label>
                    <textarea
                      rows={4}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., Will I see this crush again? / Will this role bring growth?"
                      className={`w-full bg-white/[0.04] backdrop-blur-md border border-white/10 ${activeTheme.focusBorderClass} rounded-lg px-3.5 py-2.5 text-xs leading-relaxed text-[#EDEFF5] placeholder-white/30 outline-none transition-colors resize-none`}
                    />
                  </div>

                  {errorMsg && isFlipped && <p className="text-xs text-red-300">{errorMsg}</p>}
                </div>

                <div className="relative z-10 flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                  <span className="text-xs text-white/55 font-mono tabular-nums">
                    {cards.length} / {MAX_MAGIC_CARDS} card
                  </span>
                  <button
                    type="button"
                    onClick={handlePushToTray}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm ${activeTheme.buttonClass}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingId ? 'Update Card' : 'Stage Card'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSPARENT GLASS CARD SLOT + SUBMIT CARD */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-4 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4A853]" />
            <h3 className="text-sm font-semibold text-[#EDEFF5]">Thread Card</h3>
            <span className="text-xs font-mono tabular-nums text-[#8E95A5]">
              · {cards.length} / {MAX_MAGIC_CARDS}
            </span>
          </div>

          <button
            type="button"
            disabled={cards.length === 0 || !isRangeValid || !isFutureValid || isSubmitting}
            onClick={onSubmitThread}
            className="px-5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isSubmitting
                ? 'Reading Card...'
                : 'Submit Card'}
            </span>
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="border border-dashed border-white/15 rounded-xl py-5 text-center bg-white/[0.015]">
            <p className="text-xs text-[#8E95A5]">
              No card staged yet. Choose a theme above, fill in what happened, flip to ask your question, and stage your card.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {cards.map((card) => {
              const cTheme = getCardTheme(card.domain);
              const CardIcon = cTheme.icon;
              const isEditing = editingId === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => handleEditFromTray(card)}
                  className={`group cursor-pointer relative overflow-hidden rounded-xl border p-3.5 transition-all ${
                    cTheme.surfaceGradient
                  } ${
                    isEditing ? cTheme.activeBorderClass : `${cTheme.borderClass} hover:border-white/30`
                  } shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_rgba(0,0,0,0.3)]`}
                  style={{ backgroundImage: cTheme.ambientGlow }}
                >
                  <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${cTheme.accentText}`}
                    >
                      <CardIcon className="w-3.5 h-3.5" />
                      <span>{cTheme.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromTray(card.id);
                      }}
                      title="Remove card"
                      className="text-white/45 hover:text-red-300 p-0.5 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="relative z-10 text-xs font-semibold text-[#EDEFF5] truncate">
                    {card.title}
                  </p>
                  <p className="relative z-10 text-[11px] text-white/65 line-clamp-1 mt-1">
                    Q: {card.question}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
