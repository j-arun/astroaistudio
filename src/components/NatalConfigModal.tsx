import React, { useState } from 'react';
import { Globe, RefreshCw, X } from 'lucide-react';
import { AstroProfile, StudioApiConfig } from '../types/astro';
import { ARUN_NATAL_DUMP, isValidPersonId } from '../data/sampleProfiles';

interface NatalConfigModalProps {
  isOpen: boolean;
  mode: 'edit' | 'create';
  profile?: AstroProfile;
  apiConfig: StudioApiConfig;
  onClose: () => void;
  onSave: (profile: AstroProfile, nextApiConfig: StudioApiConfig) => void;
}

function joinEndpoint(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : '';
}

export const NatalConfigModal: React.FC<NatalConfigModalProps> = ({
  isOpen,
  mode,
  profile,
  apiConfig,
  onClose,
  onSave,
}) => {
  const [personId, setPersonId] = useState(
    mode === 'edit' && profile ? profile.personId : '001ME'
  );
  const [name, setName] = useState(mode === 'edit' && profile ? profile.name : '');
  const [roleLabel, setRoleLabel] = useState(
    mode === 'edit' && profile ? profile.roleLabel : 'Primary Chart'
  );
  const [natalDump, setNatalDump] = useState(
    mode === 'edit' && profile ? profile.natalDump : ARUN_NATAL_DUMP
  );

  const [baseApiUrl, setBaseApiUrl] = useState(apiConfig.baseApiUrl || '');
  const [natalEndpointPath, setNatalEndpointPath] = useState(
    apiConfig.natalEndpointPath || '/api/natal/dump'
  );
  const [transitEndpointPath, setTransitEndpointPath] = useState(
    apiConfig.transitEndpointPath || '/api/transit/dump'
  );
  const [apiBearerToken, setApiBearerToken] = useState(apiConfig.apiBearerToken || '');

  const [isFetchingNatal, setIsFetchingNatal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const trimmedPersonId = personId.trim().toUpperCase();
  const personIdValid = isValidPersonId(trimmedPersonId);

  const resolvedNatalPreview = `${
    joinEndpoint(baseApiUrl, natalEndpointPath) || natalEndpointPath
  }?personId=${encodeURIComponent(trimmedPersonId || '001ME')}`;

  const resolvedTransitPreview = `${
    joinEndpoint(baseApiUrl, transitEndpointPath) || transitEndpointPath
  }?personId=${encodeURIComponent(trimmedPersonId || '001ME')}&from=June+2026&to=August+2026`;

  const handleFetchNatalFromApi = async () => {
    setFetchError(null);
    setFetchStatus(null);

    if (!baseApiUrl.trim()) {
      setFetchError('Enter the API Base URL first (e.g., http://localhost:5000).');
      return;
    }
    if (!personIdValid) {
      setFetchError('Profile ID (personId) must be 5 to 7 alphanumeric characters (e.g., 001ME).');
      return;
    }

    const endpointUrl = joinEndpoint(baseApiUrl, natalEndpointPath);
    setIsFetchingNatal(true);
    try {
      const res = await fetch('/api/external/fetch-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: endpointUrl,
          method: 'GET',
          bearerToken: apiBearerToken.trim(),
          queryParams: {
            personId: trimmedPersonId,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch natal dump from API.');
      }
      if (data.text) {
        setNatalDump(data.text);
        setFetchStatus(`Loaded from ${data.resolvedUrl}`);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Unable to reach Natal API.');
    } finally {
      setIsFetchingNatal(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personIdValid) {
      setFetchError('Profile ID (personId) must be 5 to 7 alphanumeric characters (e.g., 001ME).');
      return;
    }
    if (!name.trim() || !natalDump.trim()) return;
    onSave(
      {
        id: mode === 'edit' && profile ? profile.id : `profile-${Date.now()}`,
        personId: trimmedPersonId,
        name: name.trim(),
        roleLabel: roleLabel.trim() || 'Chart Profile',
        natalDump: natalDump.trim(),
        updatedAt: new Date().toISOString(),
      },
      {
        baseApiUrl: baseApiUrl.trim(),
        natalEndpointPath: natalEndpointPath.trim() || '/api/natal/dump',
        transitEndpointPath: transitEndpointPath.trim() || '/api/transit/dump',
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
                : `Profile & REST API Configuration · ${profile?.name}`}
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Set your 5–7 char Profile ID (<span className="font-mono text-[#D4A853]">personId</span>) and external API endpoints once per session.
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
          {/* Profile Metadata + 5-7 Char personId */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#8E95A5]">
                  Profile ID (personId)
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    personIdValid ? 'text-[#D4A853]' : 'text-red-400'
                  }`}
                >
                  5–7 chars
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={7}
                value={personId}
                onChange={(e) => setPersonId(e.target.value.toUpperCase())}
                placeholder="001ME"
                className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-[#EDEFF5] outline-none"
              />
            </div>
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
                placeholder="e.g., Primary Chart"
                className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] outline-none"
              />
            </div>
          </div>

          {/* REST API Configuration */}
          <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEFF5]">
                <Globe className="w-3.5 h-3.5 text-[#D4A853]" />
                <span>External REST API Endpoints</span>
              </div>
              <button
                type="button"
                disabled={isFetchingNatal}
                onClick={handleFetchNatalFromApi}
                className="px-3 py-1.5 bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingNatal ? 'animate-spin' : ''}`} />
                <span>{isFetchingNatal ? 'Fetching...' : 'Fetch Natal Dump'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  API Base URL
                </label>
                <input
                  type="url"
                  value={baseApiUrl}
                  onChange={(e) => setBaseApiUrl(e.target.value)}
                  placeholder="http://localhost:5000"
                  className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Bearer Token (Optional)
                </label>
                <input
                  type="password"
                  value={apiBearerToken}
                  onChange={(e) => setApiBearerToken(e.target.value)}
                  placeholder="Optional Authorization header"
                  className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Natal Endpoint Path
                </label>
                <input
                  type="text"
                  value={natalEndpointPath}
                  onChange={(e) => setNatalEndpointPath(e.target.value)}
                  placeholder="/api/natal/dump"
                  className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8E95A5] mb-1">
                  Transit Endpoint Path
                </label>
                <input
                  type="text"
                  value={transitEndpointPath}
                  onChange={(e) => setTransitEndpointPath(e.target.value)}
                  placeholder="/api/transit/dump"
                  className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-1.5 text-xs font-mono text-[#EDEFF5] outline-none"
                />
              </div>
            </div>

            {/* Live Query Preview */}
            <div className="bg-[#181B22] border border-[#262A34] rounded-lg px-3 py-2 space-y-1 text-[11px] font-mono text-[#8E95A5]">
              <div className="truncate">
                <span className="text-[#D4A853]">GET Natal:</span> {resolvedNatalPreview}
              </div>
              <div className="truncate">
                <span className="text-[#D4A853]">GET Transit:</span> {resolvedTransitPreview}
              </div>
            </div>

            {fetchStatus && <p className="text-xs text-emerald-400">{fetchStatus}</p>}
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
              rows={10}
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
