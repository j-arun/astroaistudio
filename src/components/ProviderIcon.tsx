import React, { useId } from 'react';
import { Cpu, FileText } from 'lucide-react';
import { ImportedSourceSystem, LlmProvider } from '../types/astro';

interface ProviderIconProps {
  provider?: LlmProvider | null;
  importedSource?: ImportedSourceSystem;
  model?: string;
  className?: string;
}

/**
 * Renders the proprietary provider mark for threads in the sidebar and headers:
 * - Anthropic Cloud / Claude (Fable / Claude imported): warm coral radial starburst
 * - ChatGPT / OpenAI (imported): emerald OpenAI blossom mark
 * - Google Gemini: 4-pointed concave diamond star
 * - Ollama / Local: Cpu icon
 * - Other imported files: FileText icon
 */
export const ProviderIcon: React.FC<ProviderIconProps> = ({
  provider,
  importedSource,
  model,
  className = 'w-3.5 h-3.5',
}) => {
  const gradId = useId();

  if (importedSource === 'chatgpt') {
    const label = model ? `ChatGPT (Imported) · ${model}` : 'ChatGPT (Imported)';
    return (
      <span
        title={label}
        aria-label={label}
        className="inline-flex items-center justify-center shrink-0 text-[#10A37F]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
        </svg>
      </span>
    );
  }

  if (importedSource === 'claude' || provider === 'fable') {
    const label = importedSource === 'claude'
      ? model
        ? `Claude (Imported) · ${model}`
        : 'Claude (Imported)'
      : model
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

  if (importedSource === 'gemini' || provider === 'gemini') {
    const label = importedSource === 'gemini'
      ? model
        ? `Gemini (Imported) · ${model}`
        : 'Gemini (Imported)'
      : model
      ? `Google Gemini · ${model}`
      : 'Google Gemini';
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

  if (importedSource === 'other') {
    const label = model ? `Imported Report · ${model}` : 'Imported Report';
    return (
      <span
        title={label}
        aria-label={label}
        className="inline-flex items-center justify-center shrink-0 text-[#9A6712] dark:text-[#D4A853]"
      >
        <FileText className={className} />
      </span>
    );
  }

  const label = model ? `Private LLM · ${model}` : 'Private LLM (Ollama)';
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400"
    >
      <Cpu className={className} />
    </span>
  );
};
