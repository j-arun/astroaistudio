import React, { useState } from 'react';
import { ArrowRight, Calendar, MessageSquare, Send, Sparkles } from 'lucide-react';
import { AstroThread, MagicCard } from '../types/astro';
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
  const [draftMessage, setDraftMessage] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const pastLabel = formatMonthRangeLabel(
    thread.narrativeWindow.startMonth,
    thread.narrativeWindow.endMonth
  );
  const futureLabel = formatMonthRangeLabel(
    thread.futureWindow.startMonth,
    thread.futureWindow.endMonth
  );

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed || isSendingChat) return;
    onSendChat(trimmed);
    setDraftMessage('');
  };

  const prefillCardQuestion = (card: MagicCard, index: number) => {
    setDraftMessage(
      `Regarding Card #${index + 1} (${card.domain} · "${card.title}" on ${card.eventDate}): `
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* 3-Fold Context Banner */}
      <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-[#8E95A5]">
            <span className="text-[#D4A853] font-semibold">3-Fold Context Locked</span>
            <span aria-hidden="true">·</span>
            <span>Past Anchor: {pastLabel}</span>
            <ArrowRight className="w-3 h-3 text-[#6C7384]" />
            <span>Future Window: {futureLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{thread.cards.length} Magic Cards</span>
          </div>
        </div>

        {thread.overallSynthesis && (
          <p className="text-sm leading-relaxed text-[#D8DCE6]">{thread.overallSynthesis}</p>
        )}
      </div>

      {/* Opened Magic Cards Spread */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#EDEFF5] tracking-tight">
            Opened Magic Cards · {futureLabel} Outlook
          </h3>
          <span className="text-xs text-[#8E95A5]">
            Click any card to drill deeper in the thread below
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {thread.cards.map((card, index) => {
            const isExpanded = expandedCards[card.id] ?? true;
            return (
              <div
                key={card.id}
                className="bg-[#181B22] border border-[#262A34] rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Kicker */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[#8E95A5]">
                      <span className="font-mono font-semibold text-[#D4A853]">
                        Card #{index + 1}
                      </span>
                      <span>·</span>
                      <span className="text-[#EDEFF5] font-medium">{card.domain}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {card.eventDate}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(card.id)}
                      className="text-[11px] text-[#8E95A5] hover:text-[#EDEFF5]"
                    >
                      {isExpanded ? 'Compact' : 'Expand'}
                    </button>
                  </div>

                  {/* Front: Past Event */}
                  <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3 space-y-1">
                    <div className="text-[11px] font-mono text-[#6C7384]">
                      PAST NARRATIVE (CALIBRATION)
                    </div>
                    <div className="text-sm font-semibold text-[#EDEFF5]">{card.title}</div>
                    <p className="text-xs text-[#A1A8B8] leading-relaxed">{card.narrative}</p>
                  </div>

                  {/* Back: User Question */}
                  <div className="px-1">
                    <div className="text-[11px] font-mono text-[#D4A853] mb-0.5">
                      YOUR QUESTION
                    </div>
                    <p className="text-sm font-medium text-[#EDEFF5] leading-snug">
                      {card.question}
                    </p>
                  </div>

                  {/* AI Reading */}
                  {card.reading && isExpanded && (
                    <div className="border-t border-[#262A34] pt-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-[#D4A853] flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          ASTROLOGICAL READING
                        </span>
                        <span className="font-mono tabular-nums text-[#8E95A5]">
                          Peak: {card.reading.timingWindow}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-[#E4E7F0]">
                        {card.reading.verdictSummary}
                      </p>
                      <div className="text-[11px] leading-relaxed text-[#8E95A5] bg-[#111318] border border-[#262A34] rounded-md px-3 py-2">
                        <span className="text-[#B9C0D0] font-medium">Triggers: </span>
                        {card.reading.planetaryTriggers}
                      </div>
                      <p className="text-[11px] text-[#B9C0D0] leading-relaxed">
                        <span className="text-[#D4A853] font-medium">Guidance: </span>
                        {card.reading.guidance}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#262A34] flex justify-end">
                  <button
                    type="button"
                    onClick={() => prefillCardQuestion(card, index)}
                    className="text-xs font-medium text-[#D4A853] hover:text-[#DFB96B] flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask follow-up on Card #{index + 1}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flowing Thread Follow-Up Conversation */}
      <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#262A34] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#EDEFF5]">
              Flowing Thread Conversation
            </h3>
            <p className="text-xs text-[#8E95A5]">
              Full Natal Dump + {thread.cards.length} Magic Cards + Past &amp; Future Transits stay loaded in context
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {thread.messages.length === 0 ? (
            <p className="text-xs text-[#8E95A5] py-2">
              Ask any follow-up question referencing your cards, specific dates, or upcoming sub-transits (e.g., &ldquo;Between Card #2 and Card #4, which resolves first in January?&rdquo;).
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
                Cross-checking Natal D1–D144, SAV/BAV, and Gochara window...
              </div>
            </div>
          )}

          {chatError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-3.5 py-2.5 text-xs text-red-300">
              {chatError}
            </div>
          )}
        </div>

        {/* Prompt Input */}
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
            placeholder="Ask a follow-up question about Card #1, Card #2, Dasha shifts, or exact dates..."
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
