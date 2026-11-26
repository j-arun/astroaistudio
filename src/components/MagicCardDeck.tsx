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

export const MAX_MAGIC_CARDS = 3;

interface MagicCardDeckProps {
  startMonth: string;
  endMonth: string;
  isRangeValid: boolean;
  isFutureValid: boolean;
  isSubmitting: boolean;
  cards: MagicCard[];
  onChangeCards: (cards: MagicCard[]) => void;
  onSubmitThread: () => void;
}

const DOMAINS: CardDomain[] = [
  'Career',
  'Love',
  'Finance',
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
  const [domain, setDomain] = useState<CardDomain>('Career');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(bounds.minDate);
  const [narrative, setNarrative] = useState('');
  const [question, setQuestion] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMaxReached = cards.length >= MAX_MAGIC_CARDS && !editingId;

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
    setDomain('Career');
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
      setErrorMsg(`Maximum ${MAX_MAGIC_CARDS} cards allowed. Edit a card in the tray or click Submit Cards.`);
      return;
    }
    if (!title.trim() || !narrative.trim()) {
      setErrorMsg('Enter an event name and brief narrative before flipping the card.');
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
      setErrorMsg(`Maximum ${MAX_MAGIC_CARDS} cards allowed.`);
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
      setErrorMsg('Write the question on the back of this card before adding to tray.');
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
    setDomain(card.domain);
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
            Magic Cards · Up to 3 Cards Maximum
          </h2>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Fill the event on the Front ({bounds.minDate} to {bounds.maxDate}), flip the card to ask your question, and submit up to 3 cards.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#D4A853]">
          {cards.length} / {MAX_MAGIC_CARDS} cards
        </span>
      </div>

      {/* 3D Flippable Magic Card Builder (or Max Reached Notice if not editing) */}
      {isMaxReached ? (
        <div className="max-w-2xl mx-auto bg-[#181B22] border border-[#D4A853]/40 rounded-xl p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-[#EDEFF5]">
            3 / 3 Magic Cards Ready
          </p>
          <p className="text-xs text-[#8E95A5]">
            Maximum 3 cards reached. Click any card in the tray below to edit it, or click <span className="text-[#D4A853] font-medium">Submit Cards</span>.
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="perspective-1200">
            <div
              className={`relative w-full transition-transform duration-500 preserve-3d ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{ minHeight: '340px' }}
            >
              {/* FRONT FACE — PAST EVENT NARRATIVE */}
              <div
                className={`w-full rounded-xl bg-[#181B22] border border-[#2D3240] p-5 backface-hidden flex flex-col justify-between ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#262A34] pb-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[#D4A853] font-semibold">
                        CARD {editingId ? 'EDIT' : `#${cards.length + 1}`} · FRONT
                      </span>
                      <span className="text-[#555C6E]">·</span>
                      <span className="text-[#8E95A5]">Event Narrative</span>
                    </div>
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="text-xs text-[#8E95A5] hover:text-[#EDEFF5]"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Domain Selector */}
                  <div>
                    <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                      Domain
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DOMAINS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDomain(d)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            domain === d
                              ? 'bg-[#D4A853] text-[#111318]'
                              : 'bg-[#111318] text-[#B9C0D0] border border-[#262A34] hover:border-[#3A4152]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title + Typed Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Event Name
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Saw crush at cafe / Borrowed 5k / Exam"
                        className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Narrative Details */}
                  <div>
                    <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                      What Happened
                    </label>
                    <textarea
                      rows={3}
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                      placeholder="Describe what happened during this past period..."
                      className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors resize-none"
                    />
                  </div>

                  {errorMsg && !isFlipped && <p className="text-xs text-red-400">{errorMsg}</p>}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#262A34]">
                  <span className="text-[11px] font-mono text-[#6C7384]">
                    {bounds.minDate} .. {bounds.maxDate}
                  </span>
                  <button
                    type="button"
                    onClick={handleFlipToQuestion}
                    className="px-4 py-2 text-xs font-semibold bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Flip Card for Question</span>
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* BACK FACE — QUESTION SIDE */}
              <div
                className={`absolute inset-0 w-full rounded-xl bg-[#1A1E27] border border-[#D4A853]/40 p-5 backface-hidden rotate-y-180 flex flex-col justify-between ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#262A34] pb-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[#D4A853] font-semibold">BACK SIDE</span>
                      <span className="text-[#555C6E]">·</span>
                      <span className="text-[#8E95A5]">Your Question</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(false)}
                      className="text-xs text-[#B9C0D0] hover:text-[#EDEFF5] flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Flip to Front
                    </button>
                  </div>

                  <div className="bg-[#111318] border border-[#262A34] rounded-lg px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#8E95A5]">
                      <span className="text-[#D4A853] font-medium">{domain}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{eventDate}</span>
                    </div>
                    <p className="text-sm font-medium text-[#EDEFF5] mt-0.5 truncate">
                      {title || 'Untitled Event'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#EDEFF5] mb-1.5">
                      Question for the Future Target Period
                    </label>
                    <textarea
                      rows={4}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., Will I see this crush again? / Will my friend ask for the 5k back?"
                      className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3.5 py-2.5 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors resize-none"
                    />
                  </div>

                  {errorMsg && isFlipped && <p className="text-xs text-red-400">{errorMsg}</p>}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#262A34]">
                  <span className="text-xs text-[#8E95A5]">
                    {cards.length} / {MAX_MAGIC_CARDS} cards
                  </span>
                  <button
                    type="button"
                    onClick={handlePushToTray}
                    className="px-4 py-2 text-xs font-semibold bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingId ? 'Update Card' : 'Add Card to Stack'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CARD TRAY + SUBMIT CARDS */}
      <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4A853]" />
            <h3 className="text-sm font-semibold text-[#EDEFF5]">Card Stack</h3>
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
                ? 'Shuffling & Reading...'
                : `Submit Cards (${cards.length})`}
            </span>
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="border border-dashed border-[#2A2F3B] rounded-lg py-5 text-center">
            <p className="text-xs text-[#8E95A5]">
              No cards added yet. Fill a card above, flip it to ask your question, and add up to 3 cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {cards.map((card, index) => (
              <div
                key={card.id}
                onClick={() => handleEditFromTray(card)}
                className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
                  editingId === card.id
                    ? 'bg-[#222631] border-[#D4A853]/60'
                    : 'bg-[#111318] border-[#262A34] hover:border-[#3A4152]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#8E95A5] mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono text-[#D4A853]">#{index + 1}</span>
                    <span>·</span>
                    <span>{card.domain}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromTray(card.id);
                    }}
                    title="Remove card"
                    className="text-[#6C7384] hover:text-red-400 p-0.5 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs font-semibold text-[#EDEFF5] truncate">{card.title}</p>
                <p className="text-[11px] text-[#8E95A5] line-clamp-1 mt-1">
                  Q: {card.question}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
