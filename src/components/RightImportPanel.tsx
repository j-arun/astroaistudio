import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  FileCode2,
  FileUp,
  PanelRightClose,
  Upload,
} from 'lucide-react';
import { ImportedSourceSystem } from '../types/astro';
import { ImportFileFormat } from '../data/importedReportParser';

interface LastImportSummary {
  title: string;
  format: ImportFileFormat;
  source: ImportedSourceSystem;
  matchedFields: string[];
}

interface RightImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImportContent: (params: {
    rawContent: string;
    fileName?: string;
    preferredSource: ImportedSourceSystem | 'auto';
    customTitle?: string;
  }) => LastImportSummary;
}

const SOURCE_OPTIONS: Array<{ id: ImportedSourceSystem | 'auto'; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'other', label: 'Other' },
];

export const RightImportPanel: React.FC<RightImportPanelProps> = ({
  isOpen,
  onClose,
  onImportContent,
}) => {
  const [sourceChoice, setSourceChoice] = useState<ImportedSourceSystem | 'auto'>('auto');
  const [customTitle, setCustomTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<LastImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportError(null);

    const files = Array.from(fileList);
    let latestSummary: LastImportSummary | null = null;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        latestSummary = onImportContent({
          rawContent: text,
          fileName: file.name,
          preferredSource: sourceChoice,
          customTitle: files.length === 1 ? customTitle : undefined,
        });
      } catch (err: unknown) {
        errors.push(
          `${file.name}: ${err instanceof Error ? err.message : 'Unable to parse file'}`
        );
      }
    }

    if (latestSummary) {
      setLastImport(latestSummary);
      if (files.length === 1) {
        setCustomTitle('');
      }
    }
    if (errors.length > 0) {
      setImportError(errors.join(' · '));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    void processFiles(e.dataTransfer.files);
  };

  const handlePasteImport = () => {
    setImportError(null);
    if (!pastedText.trim()) {
      setImportError('Paste Markdown, HTML, or JSON output before importing.');
      return;
    }
    try {
      const summary = onImportContent({
        rawContent: pastedText,
        fileName: undefined,
        preferredSource: sourceChoice,
        customTitle,
      });
      setLastImport(summary);
      setPastedText('');
      setCustomTitle('');
      setShowPasteBox(false);
    } catch (err: unknown) {
      setImportError(
        err instanceof Error ? err.message : 'Unable to parse pasted output.'
      );
    }
  };

  return (
    <aside
      aria-label="Import external Markdown reports"
      className="w-80 shrink-0 bg-white/[0.035] backdrop-blur-2xl border-l border-white/[0.1] shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.09] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-[#EDEFF5] truncate">
            Import External Report
          </h2>
          <p className="text-[11px] text-[#8E95A5] truncate mt-0.5">
            Upload Claude or ChatGPT output
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Collapse upload panel"
          aria-label="Collapse upload panel"
          className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[#98A0B2] hover:text-[#EDEFF5] transition-colors shrink-0"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Format Recommendation Notice */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#D4A853]">
            <FileCode2 className="w-3.5 h-3.5 shrink-0" />
            <span>Preferred format: Markdown (.md)</span>
          </div>
          <p className="text-[11px] text-[#98A0B2] leading-relaxed">
            Upload <span className="font-mono text-[#EDEFF5]">.md</span> files from Claude or ChatGPT for the cleanest section parsing. Also accepts{' '}
            <span className="font-mono text-[#C8CEDB]">.html</span>,{' '}
            <span className="font-mono text-[#C8CEDB]">.txt</span>, and{' '}
            <span className="font-mono text-[#C8CEDB]">.json</span>.
          </p>
        </div>

        {/* Source System Selector */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-[#98A0B2]">
            Source System
          </label>
          <div className="grid grid-cols-5 gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.03]">
            {SOURCE_OPTIONS.map((opt) => {
              const active = sourceChoice === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSourceChoice(opt.id)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#D4A853] text-[#111318] font-semibold'
                      : 'text-[#98A0B2] hover:text-[#EDEFF5] hover:bg-white/[0.05]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Custom Thread Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="import-thread-title"
            className="block text-[11px] font-medium text-[#98A0B2]"
          >
            Thread Title (optional)
          </label>
          <input
            id="import-thread-title"
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Auto-detect from heading or filename"
            className="w-full bg-white/[0.04] border border-white/12 focus:border-[#D4A853] rounded-xl px-3 py-2 text-xs text-[#EDEFF5] placeholder-[#5B6273] outline-none transition-colors"
          />
        </div>

        {/* Drag & Drop MD Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center space-y-2.5 transition-all ${
            isDragging
              ? 'border-[#D4A853] bg-[#D4A853]/12'
              : 'border-white/20 bg-white/[0.025] hover:border-[#D4A853]/60 hover:bg-white/[0.045]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.markdown,.html,.htm,.txt,.json,text/markdown,text/html,text/plain,application/json"
            onChange={(e) => {
              void processFiles(e.target.files);
              e.currentTarget.value = '';
            }}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-xl border border-[#D4A853]/35 bg-[#D4A853]/10 text-[#D4A853] flex items-center justify-center mx-auto">
            <FileUp className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#EDEFF5]">
              Drop .md or .html file here
            </div>
            <p className="text-[11px] text-[#8E95A5]">
              or click to browse from computer
            </p>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4A853] text-[#111318] text-[11px] font-semibold">
              <Upload className="w-3 h-3" />
              Choose File
            </span>
          </div>
        </div>

        {/* Direct Paste Toggle */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowPasteBox((v) => !v);
              setImportError(null);
            }}
            className="w-full py-2 px-3 rounded-xl border border-white/12 bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium text-[#C8CEDB] hover:text-[#EDEFF5] inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-[#D4A853]" />
            <span>{showPasteBox ? 'Hide Paste Box' : 'Or Paste Output Text'}</span>
          </button>

          {showPasteBox && (
            <div className="rounded-xl border border-white/12 bg-white/[0.03] p-3 space-y-2.5">
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the Markdown, JSON, or HTML output generated in Claude or ChatGPT..."
                className="w-full bg-black/25 border border-white/12 focus:border-[#D4A853] rounded-lg px-2.5 py-2 text-[11px] font-mono leading-relaxed text-[#EDEFF5] placeholder-[#5B6273] outline-none resize-y"
              />
              <button
                type="button"
                onClick={handlePasteImport}
                disabled={!pastedText.trim()}
                className="w-full py-2 px-3 rounded-lg bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold transition-colors"
              >
                Parse &amp; Add to Imported Threads
              </button>
            </div>
          )}
        </div>

        {/* Error Notice */}
        {importError && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200 leading-relaxed">
            {importError}
          </div>
        )}

        {/* Latest Import Feedback */}
        {lastImport && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{lastImport.title}</span>
            </div>
            <div className="text-[11px] font-mono text-emerald-200/80 flex flex-wrap items-center gap-1.5">
              <span>{lastImport.format.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{lastImport.source}</span>
              <span aria-hidden="true">·</span>
              <span>{lastImport.matchedFields.length} parsed</span>
            </div>
            {lastImport.matchedFields.length > 0 && (
              <p className="text-[11px] text-[#C8CEDB] leading-relaxed">
                Extracted: {lastImport.matchedFields.join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-white/[0.09] bg-white/[0.02] text-[11px] text-[#7D8596] leading-relaxed">
        Saved offline in <span className="text-[#C8CEDB]">Imported Threads</span> without Magic Cards.
      </div>
    </aside>
  );
};
