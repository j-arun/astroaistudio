import React, { useState } from 'react';
import { ParsedNatalSummary } from '../types/astro';
import { SHORT_SIGNS } from '../data/sampleProfiles';

interface KundaliChartProps {
  natal: ParsedNatalSummary;
}

// South Indian fixed-sign grid coordinates (col, row in 4x4 grid, center 2x2 open)
const SOUTH_SIGN_CELLS: Array<{ signIndex: number; col: number; row: number }> = [
  { signIndex: 11, col: 0, row: 0 }, // Pisces
  { signIndex: 0, col: 1, row: 0 },  // Aries
  { signIndex: 1, col: 2, row: 0 },  // Taurus
  { signIndex: 2, col: 3, row: 0 },  // Gemini
  { signIndex: 3, col: 3, row: 1 },  // Cancer
  { signIndex: 4, col: 3, row: 2 },  // Leo
  { signIndex: 5, col: 3, row: 3 },  // Virgo
  { signIndex: 6, col: 2, row: 3 },  // Libra
  { signIndex: 7, col: 1, row: 3 },  // Scorpio
  { signIndex: 8, col: 0, row: 3 },  // Sagittarius
  { signIndex: 9, col: 0, row: 2 },  // Capricorn
  { signIndex: 10, col: 0, row: 1 }, // Aquarius
];

// North Indian diamond center coordinates for Houses 1..12 inside 280x280 SVG
const NORTH_HOUSE_POSITIONS: Array<{ house: number; x: number; y: number }> = [
  { house: 1, x: 140, y: 74 },
  { house: 2, x: 74, y: 36 },
  { house: 3, x: 36, y: 74 },
  { house: 4, x: 74, y: 140 },
  { house: 5, x: 36, y: 206 },
  { house: 6, x: 74, y: 244 },
  { house: 7, x: 140, y: 206 },
  { house: 8, x: 206, y: 244 },
  { house: 9, x: 244, y: 206 },
  { house: 10, x: 206, y: 140 },
  { house: 11, x: 244, y: 74 },
  { house: 12, x: 206, y: 36 },
];

const DIVISIONAL_TABS = ['D1', 'D9', 'D10', 'D24', 'D60', 'D144'];

export const KundaliChart: React.FC<KundaliChartProps> = ({ natal }) => {
  const [style, setStyle] = useState<'south' | 'north'>('south');
  const [activeDiv, setActiveDiv] = useState<string>('D1');

  const getHouseBySign = (signIndex: number) =>
    natal.d1Houses.find((h) => h.signIndex === signIndex);

  const getHouseByNumber = (houseNum: number) =>
    natal.d1Houses.find((h) => h.house === houseNum);

  return (
    <div className="space-y-4">
      {/* Header & Style Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-[#EDEFF5] tracking-tight">
            Natal Kundali &amp; Divisional View
          </h3>
          <p className="text-[11px] text-[#8E95A5]">
            {natal.lagna.split('(')[0].trim()} Lagna · {natal.moonSign.split('(')[0].trim()} Moon
          </p>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[#111318] border border-[#262A34]">
          <button
            type="button"
            onClick={() => setStyle('south')}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              style === 'south'
                ? 'bg-[#262A34] text-[#EDEFF5]'
                : 'text-[#8E95A5] hover:text-[#EDEFF5]'
            }`}
          >
            South
          </button>
          <button
            type="button"
            onClick={() => setStyle('north')}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              style === 'north'
                ? 'bg-[#262A34] text-[#EDEFF5]'
                : 'text-[#8E95A5] hover:text-[#EDEFF5]'
            }`}
          >
            North
          </button>
        </div>
      </div>

      {/* SVG Kundali */}
      <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3 flex justify-center">
        {style === 'south' ? (
          <svg viewBox="0 0 280 280" className="w-full max-w-[264px] h-auto select-none">
            <rect
              x="1"
              y="1"
              width="278"
              height="278"
              fill="none"
              stroke="#313644"
              strokeWidth="1"
            />
            {/* Grid lines leaving 2x2 center open */}
            <line x1="70" y1="0" x2="70" y2="280" stroke="#262A34" strokeWidth="1" />
            <line x1="210" y1="0" x2="210" y2="280" stroke="#262A34" strokeWidth="1" />
            <line x1="140" y1="0" x2="140" y2="70" stroke="#262A34" strokeWidth="1" />
            <line x1="140" y1="210" x2="140" y2="280" stroke="#262A34" strokeWidth="1" />
            <line x1="0" y1="70" x2="280" y2="70" stroke="#262A34" strokeWidth="1" />
            <line x1="0" y1="210" x2="280" y2="210" stroke="#262A34" strokeWidth="1" />
            <line x1="0" y1="140" x2="70" y2="140" stroke="#262A34" strokeWidth="1" />
            <line x1="210" y1="140" x2="280" y2="140" stroke="#262A34" strokeWidth="1" />

            {/* Center inscription */}
            <text
              x="140"
              y="128"
              textAnchor="middle"
              fill="#D4A853"
              fontSize="11"
              fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {activeDiv} Chart
            </text>
            <text
              x="140"
              y="144"
              textAnchor="middle"
              fill="#8E95A5"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              SAV {natal.savTotal}
            </text>
            <text
              x="140"
              y="160"
              textAnchor="middle"
              fill="#6C7384"
              fontSize="8.5"
              fontFamily="DM Sans, sans-serif"
            >
              {natal.nakshatra.split(' ')[0]}
            </text>

            {/* 12 Sign Cells */}
            {SOUTH_SIGN_CELLS.map(({ signIndex, col, row }) => {
              const h = getHouseBySign(signIndex);
              const x = col * 70;
              const y = row * 70;
              const isLagna = h?.house === 1;
              return (
                <g key={signIndex}>
                  {isLagna && (
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width="68"
                      height="68"
                      fill="#D4A853"
                      fillOpacity="0.06"
                    />
                  )}
                  <text
                    x={x + 6}
                    y={y + 13}
                    fill={isLagna ? '#D4A853' : '#6C7384'}
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {SHORT_SIGNS[signIndex]}·H{h?.house}
                  </text>
                  <text
                    x={x + 64}
                    y={y + 13}
                    textAnchor="end"
                    fill="#555C6E"
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {h?.savBindus}
                  </text>
                  {(h?.planets || []).slice(0, 4).map((p, pIdx) => (
                    <text
                      key={p}
                      x={x + 8 + (pIdx % 2) * 30}
                      y={y + 32 + Math.floor(pIdx / 2) * 16}
                      fill={p === 'As' || p === 'Mo' ? '#D4A853' : '#EDEFF5'}
                      fontSize="10"
                      fontWeight={p === 'As' || p === 'Mo' ? '600' : '500'}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {p}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        ) : (
          <svg viewBox="0 0 280 280" className="w-full max-w-[264px] h-auto select-none">
            <rect
              x="2"
              y="2"
              width="276"
              height="276"
              fill="none"
              stroke="#313644"
              strokeWidth="1"
            />
            <line x1="2" y1="2" x2="278" y2="278" stroke="#262A34" strokeWidth="1" />
            <line x1="278" y1="2" x2="2" y2="278" stroke="#262A34" strokeWidth="1" />
            <polygon
              points="140,2 278,140 140,278 2,140"
              fill="none"
              stroke="#D4A853"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            {NORTH_HOUSE_POSITIONS.map(({ house, x, y }) => {
              const h = getHouseByNumber(house);
              return (
                <g key={house}>
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fill="#6C7384"
                    fontSize="7.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {h ? `${SHORT_SIGNS[h.signIndex]} (${h.savBindus})` : `H${house}`}
                  </text>
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fill={house === 1 ? '#D4A853' : '#EDEFF5'}
                    fontSize="9.5"
                    fontWeight="500"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {(h?.planets || []).join(' ') || '—'}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Divisional Switcher (D1 - D144) */}
      <div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {DIVISIONAL_TABS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setActiveDiv(code)}
              className={`px-2 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                activeDiv === code
                  ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/40'
                  : 'text-[#8E95A5] hover:text-[#EDEFF5] border border-transparent'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#B9C0D0] bg-[#111318] border border-[#262A34] rounded-md px-3 py-2">
          {natal.divisionalHighlights[activeDiv] ||
            `${activeDiv} divisional harmonics loaded inside full natal dump context.`}
        </p>
      </div>

      {/* SAV Bindus Strip */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-[#8E95A5] mb-2">
          <span>Sarvashtakavarga (SAV)</span>
          <span className="font-mono tabular-nums text-[#D4A853]">{natal.savTotal} total</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {natal.d1Houses.map((h) => {
            const strong = h.savBindus >= 30;
            return (
              <div
                key={h.signIndex}
                className="bg-[#111318] border border-[#262A34] rounded px-2 py-1.5 text-center"
              >
                <div className="text-[10px] font-mono text-[#6C7384]">{SHORT_SIGNS[h.signIndex]}</div>
                <div
                  className={`text-xs font-mono tabular-nums font-semibold ${
                    strong ? 'text-[#D4A853]' : 'text-[#EDEFF5]'
                  }`}
                >
                  {h.savBindus}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
