import React, { useState } from 'react';
import { Globe, RefreshCw, X } from 'lucide-react';
import { AstroProfile, StudioApiConfig } from '../types/astro';
import { ARUN_NATAL_DUMP } from '../data/sampleProfiles';

interface NatalConfigModalProps {
  isOpen: boolean;
  mode: 'edit' | 'create';
  profile?: AstroProfile;
  apiConfig: StudioApiConfig;
  onClose: () => void;
  onSave: (profile: AstroProfile, nextApiConfig: StudioApiConfig) => void;
}

export const NatalConfigModal: React.FC<NatalConfigModalProps> = ({
  isOpen,
  mode,
  profile,
  apiConfig,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(mode === 'edit' && profile ? profile.name : '');
  const [roleLabel, setRoleLabel] = useState(
    mode === 'edit' && profile ? profile.roleLabel : 'Primary Chart'
  );
  const [natalDump, setNatalDump] = useState(
    mode === 'edit' && profile ? profile.natalDump : ARUN_NATAL_DUMP
  );
  const [natalApiUrl, setNatalApiUrl] = useState(
    (mode === 'edit' && profile?.natalApiUrl) || apiConfig.natalApiUrl || ''
  );
  const [transitApiUrl, setTransitApiUrl] = useState(apiConfig.transitApiUrl || '');
  const [apiBearerToken, setApiBearerToken] = useState(apiConfig.apiBearerToken || '');
  const [isFetchingNatal, setIsFetchingNatal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchNatalFromApi = async () => {
    if (!natalApiUrl.trim()) {
      setFetchError('Enter a Natal API URL first to fetch plain text.');
      return;
    }
    setIsFetchingNatal(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/external/fetch-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: natalApiUrl.trim(),
          method: 'POST',
          bearerToken: apiBearerToken.trim(),
          payload: { profileName: name.trim() || 'Profile' },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch natal dump from API.');
      }
      if (data.text) {
        setNatalDump(data.text);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Unable to reach Natal API.');
    } finally {
      setIsFetchingNatal(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !natalDump.trim()) return;
    onSave(
      {
        id: mode === 'edit' && profile ? profile.id : `profile-${Date.now()}`,
        name: name.trim(),
        roleLabel: roleLabel.trim() || 'Chart Profile',
        natalDump: natalDump.trim(),
        natalApiUrl: natalApiUrl.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
      {
        natalApiUrl: natalApiUrl.trim(),
        transitApiUrl: transitApiUrl.trim(),
        apiBearerToken: apiBearerToken.trim(),
      }
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#181B22] border border-[#2D3240] rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262A34]">
          <div>
            <h2 className="text-base font-semibold text-[#EDEFF5]">
              {mode === 'create'
                ? 'New Profile & One-Time Natal Setup'
                : `Profile & API Configuration · ${profile?.name}`}
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Configured once per profile. Remains loaded for the entire session across all threads.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8E95A5] hover:text-[#EDEFF5] p-1.5 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Profile Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                Profile Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Arun K."
                className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                Profile Label
              </label>
              <input
                type="text"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="e.g., Primary Chart / Client"
                className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] outline-none"
              />
            </div>
          </div>

          {/* API Endpoints Section */}
          <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEFF5]">
              <Globe className="w-3.5 h-3.5 text-[#D4A853]" />
              <span>External Plain-Text APIs (Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Natal Dump API URL
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={natalApiUrl}
                    onChange={(e) => setNatalApiUrl(e.target.value)}
                    placeholder="https://your-api.com/natal-dump"
                    className="flex-1 min-w-0 bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                  />
                  <button
                    type="button"
                    disabled={isFetchingNatal}
                    onClick={handleFetchNatalFromApi}
                    className="px-2.5 py-1.5 bg-[#262A34] hover:bg-[#313746] text-[#EDEFF5] text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingNatal ? 'animate-spin' : ''}`} />
                    <span>Fetch</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Transit Months API URL
                </label>
                <input
                  type="url"
                  value={transitApiUrl}
                  onChange={(e) => setTransitApiUrl(e.target.value)}
                  placeholder="https://your-api.com/transits"
                  className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                API Authorization Header / Bearer Token (Optional)
              </label>
              <input
                type="password"
                value={apiBearerToken}
                onChange={(e) => setApiBearerToken(e.target.value)}
                placeholder="Bearer token sent server-side when fetching Natal or Transit APIs"
                className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
              />
            </div>

            {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}
          </div>

          {/* Plain-Text Natal Dump Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#8E95A5]">
                Plain-Text Natal Dump (Fetched from API or pasted directly)
              </label>
              <span className="text-[11px] font-mono tabular-nums text-[#D4A853]">
                ~{Math.round(natalDump.length / 4).toLocaleString()} tokens
              </span>
            </div>
            <textarea
              required
              rows={11}
              value={natalDump}
              onChange={(e) => setNatalDump(e.target.value)}
              placeholder="Paste or fetch your complete plain-text natal dump here (D1–D144, Dasha–Bhukti, SAV/BAV)..."
              className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg p-3.5 text-xs font-mono leading-relaxed text-[#D8DCE6] outline-none resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262A34]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#B9C0D0] hover:text-[#EDEFF5] border border-[#262A34] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] rounded-lg transition-colors"
            >
              Apply &amp; Save for Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
