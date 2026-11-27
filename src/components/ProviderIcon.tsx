import React, { useId } from 'react';
import { Cpu } from 'lucide-react';
import { LlmProvider } from '../types/astro';

interface ProviderIconProps {
  provider: LlmProvider;
  model?: string;
  className?: string;
}

/**
 * Renders the proprietary provider mark for threads in the sidebar:
 * - Anthropic Cloud / Claude (Fable / PaLM adapter): signature warm coral radial starburst
 * - Google Gemini: signature 4-pointed concave diamond star
 * - Ollama / Local: subtle Cpu icon
 */
export const ProviderIcon: React.FC<ProviderIconProps> = ({
  provider,
  model,
  className = 'w-3.5 h-3.5',
}) => {
  const gradId = useId();

  if (provider === 'fable') {
    const label = model
      ? `Anthropic Cloud (Fable) · ${model}`
      : 'Anthropic Cloud (Fable)';
    return (
      <span
        title={label}
        aria-label={label}
        className="inline-flex items-center justify-center shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            fill="#D97757"
            d="M17.304 3.541l-3.672 6.84 5.95-3.443a.92.92 0 0 1 1.258.338.92.92 0 0 1-.338 1.258l-6.063 3.508 6.955.948a.92.92 0 0 1 .786 1.036.92.92 0 0 1-1.036.786l-7.015-.956 4.784 5.215a.92.92 0 0 1-.055 1.3.92.92 0 0 1-1.3-.055l-4.703-5.126.95 7.04a.92.92 0 0 1-.79 1.034.92.92 0 0 1-1.034-.79l-.957-7.094-3.71 6.727a.92.92 0 0 1-1.25.362.92.92 0 0 1-.362-1.25l3.776-6.847-6.12 3.541a.92.92 0 0 1-1.258-.338.92.92 0 0 1 .338-1.258l6.142-3.554-6.976-.952a.92.92 0 0 1-.786-1.036.92.92 0 0 1 1.036-.786l6.93.945-4.753-5.182a.92.92 0 0 1 .056-1.3.92.92 0 0 1 1.3.056l4.702 5.126-.954-7.07a.92.92 0 0 1 .79-1.034.92.92 0 0 1 1.034.79l.96 7.116 3.746-6.98a.92.92 0 0 1 1.244-.376.92.92 0 0 1 .376 1.244Z"
          />
        </svg>
      </span>
    );
  }

  if (provider === 'gemini') {
    const label = model ? `Google Gemini · ${model}` : 'Google Gemini';
    return (
      <span
        title={label}
        aria-label={label}
        className="inline-flex items-center justify-center shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="2"
              y1="2"
              x2="22"
              y2="22"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#1BA1E3" />
              <stop offset="50%" stopColor="#5489D6" />
              <stop offset="100%" stopColor="#9B72CB" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gradId})`}
            d="M12 1C12.36 7.08 16.92 11.64 23 12C16.92 12.36 12.36 16.92 12 23C11.64 16.92 7.08 12.36 1 12C7.08 11.64 11.64 7.08 12 1Z"
          />
        </svg>
      </span>
    );
  }

  const label = model ? `Private LLM · ${model}` : 'Private LLM (Ollama)';
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center shrink-0 text-emerald-400"
    >
      <Cpu className={className} />
    </span>
  );
};
