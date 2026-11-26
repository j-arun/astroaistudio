import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Calendar, Layers, Send, Sparkles } from 'lucide-react';
import { AstroThread } from '../types/astro';
import { formatMonthRangeLabel } from '../data/sampleProfiles';

interface OpenedCardSpreadProps {
  thread: AstroThread;
  isSendingChat: boolean;
  chatError: string | null;
  onSendChat: (message: string) => void;
}

export const OpenedCardSpread: React.FC<OpenedCardSpreadProps> = ({
  thread,
  isSendingChat,
  chatError,
  onSendChat,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draftMessage, setDraftMessage] = useState('');

  const pastLabel = formatMonthRangeLabel(
    thread.narrativeWindow.startMonth,
    thread.narrativeWindow.endMonth
  );
  const futureLabel = formatMonthRangeLabel(
    thread.futureWindow.startMonth,
    thread.futureWindow.endMonth
  );

  const activeCard = thread.cards[selectedIndex] || thread.cards[0];

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed || isSendingChat) return;
    onSendChat(trimmed);
    setDraftMessage('');
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Macro Synthesis Header */}
      <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8E95A5]">
          <span className="text-[#D4A853] font-semibold">3-Fold Reading</span>
          <span aria-hidden="true">·</span>
          <span>{pastLabel}</span>
          <ArrowRight className="w-3 h-3 text-[#6C7384]" />
          <span className="text-[#EDEFF5] font-medium">{futureLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{thread.cards.length} Stacked Cards</span>
        </div>

        {thread.overallSynthesis && (
          <p className="text-sm leading-relaxed text-[#D8DCE6]">{thread.overallSynthesis}</p>
        )}
      </div>

      {/* Stacked Cards Selector + Focused Individual Card Reader */}
      {thread.cards.length > 0 && activeCard && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Interactive Stacked Card Deck (Click any card to read it) */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#8E95A5] px-1">
              <span className="flex items-center gap-1.5 font-medium text-[#EDEFF5]">
                <Layers className="w-3.5 h-3.5 text-[#D4A853]" />
                Stacked Cards
              </span>
              <span className="font-mono text-[11px]">Click to inspect</span>
            </div>

            <div className="space-y-2">
              {thread.cards.map((card, idx) => {
                const isActive = idx === selectedIndex;
                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    whileHover={{ x: isActive ? 0 : 4 }}
                    transition={{ duration: 0.16 }}
                    className={`w-full text-left rounded-xl p-3.5 border transition-colors relative ${
                      isActive
                        ? 'bg-[#1E222D] border-[#D4A853] shadow-lg'
                        : 'bg-[#161920] border-[#262A34] hover:border-[#3A4152]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#8E95A5] mb-1">
                      <span className="font-mono font-semibold text-[#D4A853]">
                        Card #{idx + 1} · {card.domain}
                      </span>
                      <span className="font-mono tabular-nums">{card.eventDate}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#EDEFF5] truncate">
                      {card.title}
                    </div>
                    <div className="text-xs text-[#8E95A5] line-clamp-2 mt-1">
                      Q: {card.question}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: Active Card Full Question & LLM Answer */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCard.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="bg-[#181B22] border border-[#2D3240] rounded-xl p-6 space-y-5"
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262A34] pb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#D4A853]">
                      CARD #{selectedIndex + 1}
                    </span>
                    <span className="text-[#555C6E]">·</span>
                    <span className="font-medium text-[#EDEFF5]">{activeCard.domain}</span>
                    <span className="text-[#555C6E]">·</span>
                    <span className="font-mono tabular-nums text-[#8E95A5] inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {activeCard.eventDate}
                    </span>
                  </div>
                  {activeCard.reading?.timingWindow && (
                    <span className="text-[11px] font-mono tabular-nums text-[#D4A853]">
                      Peak: {activeCard.reading.timingWindow}
                    </span>
                  )}
                </div>

                {/* Front: Past Event Narrative */}
                <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3.5 space-y-1">
                  <div className="text-[11px] font-mono text-[#6C7384]">
                    FRONT · PAST EVENT NARRATIVE
                  </div>
                  <div className="text-sm font-semibold text-[#EDEFF5]">{activeCard.title}</div>
                  <p className="text-xs text-[#A1A8B8] leading-relaxed">{activeCard.narrative}</p>
                </div>

                {/* Back: Question Asked */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-[#D4A853]">
                    BACK · QUESTION ASKED
                  </div>
                  <p className="text-base font-medium text-[#EDEFF5] leading-snug">
                    {activeCard.question}
                  </p>
                </div>

                {/* LLM Answer */}
                {activeCard.reading ? (
                  <div className="border-t border-[#262A34] pt-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#D4A853]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>LLM ENGINE READING</span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#EDEFF5]">
                      {activeCard.reading.verdictSummary}
                    </p>
                    <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3 text-xs text-[#B9C0D0] leading-relaxed">
                      <span className="font-semibold text-[#EDEFF5]">Planetary Triggers: </span>
                      {activeCard.reading.planetaryTriggers}
                    </div>
                    <p className="text-xs text-[#C8CEDB] leading-relaxed">
                      <span className="font-semibold text-[#D4A853]">Guidance: </span>
                      {activeCard.reading.guidance}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#8E95A5]">No reading attached to this card.</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Flowing Thread Follow-Up Conversation */}
      <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-5 space-y-4">
        <div className="border-b border-[#262A34] pb-3">
          <h3 className="text-sm font-semibold text-[#EDEFF5]">
            Follow-Up Questions
          </h3>
          <p className="text-xs text-[#8E95A5]">
            All 3 folds (Session Natal + Past Narrative Cards + Future Transits) stay active for this thread.
          </p>
        </div>

        <div className="space-y-4">
          {thread.messages.length === 0 ? (
            <p className="text-xs text-[#8E95A5] py-1">
              Ask a follow-up referencing Card #1, Card #2, or Card #3.
            </p>
          ) : (
            thread.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#262B38] text-[#EDEFF5] border border-[#353C4E]'
                      : 'bg-[#111318] text-[#D8DCE6] border border-[#262A34]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#8E95A5] mb-1">
                    <span className={msg.role === 'assistant' ? 'text-[#D4A853] font-medium' : 'font-medium'}>
                      {msg.role === 'user' ? 'You' : 'Astro AI'}
                    </span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))
          )}

          {isSendingChat && (
            <div className="flex justify-start">
              <div className="bg-[#111318] border border-[#262A34] rounded-xl px-4 py-3 text-xs text-[#8E95A5]">
                Analyzing follow-up across all 3 folds...
              </div>
            </div>
          )}

          {chatError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3.5 py-2.5 text-xs text-red-300">
              {chatError}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmitChat} className="flex items-end gap-2 pt-2 border-t border-[#262A34]">
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
            placeholder={`Ask a follow-up on Card #${selectedIndex + 1} or compare cards...`}
            className="flex-1 bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3.5 py-2.5 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none transition-colors resize-none"
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
    </div>
  );
};
