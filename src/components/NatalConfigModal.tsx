import React, { useState } from 'react';
import { Cpu, Globe, RefreshCw, Trash2, X } from 'lucide-react';
import { AstroProfile, LlmProvider, StudioApiConfig } from '../types/astro';
import { isValidPersonId } from '../data/sampleProfiles';

interface NatalConfigModalProps {
  isOpen: boolean;
  mode: 'edit' | 'create';
  profile?: AstroProfile;
  apiConfig: StudioApiConfig;
  onClose: () => void;
  onSave: (profile: AstroProfile, nextApiConfig: StudioApiConfig) => void;
  onSaveConfigOnly?: (nextApiConfig: StudioApiConfig) => void;
  onDelete?: (profileId: string) => void;
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
  onSaveConfigOnly,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'llm'>('profile');

  const [personId, setPersonId] = useState(
    mode === 'edit' && profile ? profile.personId : ''
  );
  const [name, setName] = useState(mode === 'edit' && profile ? profile.name : '');
  const [roleLabel, setRoleLabel] = useState(
    mode === 'edit' && profile ? profile.roleLabel : ''
  );
  const [natalDump, setNatalDump] = useState(
    mode === 'edit' && profile ? profile.natalDump : ''
  );

  const [baseApiUrl, setBaseApiUrl] = useState(apiConfig.baseApiUrl || '');
  const [natalEndpointPath, setNatalEndpointPath] = useState(
    apiConfig.natalEndpointPath || '/api/natal/dump'
  );
  const [transitEndpointPath, setTransitEndpointPath] = useState(
    apiConfig.transitEndpointPath || '/api/transit/dump'
  );
  const [apiBearerToken, setApiBearerToken] = useState(apiConfig.apiBearerToken || '');

  // LLM Adapter state
  const [llmProvider, setLlmProvider] = useState<LlmProvider>(apiConfig.llmProvider || 'gemini');
  const [geminiModel, setGeminiModel] = useState(apiConfig.geminiModel || 'gemini-4-hydrogen');
  const [fableEndpointUrl, setFableEndpointUrl] = useState(apiConfig.fableEndpointUrl || '');
  const [fableModel, setFableModel] = useState(apiConfig.fableModel || 'fable-astro-1');
  const [fableApiKey, setFableApiKey] = useState(apiConfig.fableApiKey || '');

  const [isFetchingNatal, setIsFetchingNatal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const trimmedPersonId = personId.trim().toUpperCase();
  const personIdValid = isValidPersonId(trimmedPersonId);

  const resolvedNatalPreview = `${
    joinEndpoint(baseApiUrl, natalEndpointPath) || natalEndpointPath
  }?personId=${encodeURIComponent(trimmedPersonId || '<personId>')}`;

  const resolvedTransitPreview = `${
    joinEndpoint(baseApiUrl, transitEndpointPath) || transitEndpointPath
  }?personId=${encodeURIComponent(trimmedPersonId || '<personId>')}&from=June+2026&to=August+2026`;

  const buildNextConfig = (): StudioApiConfig => ({
    baseApiUrl: baseApiUrl.trim(),
    natalEndpointPath: natalEndpointPath.trim() || '/api/natal/dump',
    transitEndpointPath: transitEndpointPath.trim() || '/api/transit/dump',
    apiBearerToken: apiBearerToken.trim(),
    llmProvider,
    geminiModel: geminiModel.trim() || 'gemini-4-hydrogen',
    fableEndpointUrl: fableEndpointUrl.trim(),
    fableModel: fableModel.trim() || 'fable-astro-1',
    fableApiKey: fableApiKey.trim(),
  });

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
    const nextConfig = buildNextConfig();

    // If user is on the LLM Adapters tab and hasn't filled profile fields yet during create, save LLM config cleanly
    if (activeTab === 'llm' && !trimmedPersonId && !name.trim() && !natalDump.trim() && onSaveConfigOnly) {
      onSaveConfigOnly(nextConfig);
      onClose();
      return;
    }

    if (!personIdValid) {
      setActiveTab('profile');
      setFetchError('Profile ID (personId) must be 5 to 7 alphanumeric characters (e.g., 001ME).');
      return;
    }
    if (!name.trim() || !natalDump.trim()) {
      setActiveTab('profile');
      setFetchError('Profile Name and Plain-Text Natal Dump are required.');
      return;
    }
    if (llmProvider === 'fable' && !fableEndpointUrl.trim()) {
      setActiveTab('llm');
      setFetchError('Enter your Fable Adapter Endpoint URL or switch back to Gemini.');
      return;
    }

    onSave(
      {
        id: mode === 'edit' && profile ? profile.id : `profile-${Date.now()}`,
        personId: trimmedPersonId,
        name: name.trim(),
        roleLabel: roleLabel.trim() || 'Chart Profile',
        natalDump: natalDump.trim(),
        updatedAt: new Date().toISOString(),
      },
      nextConfig
    );
    onClose();
  };

  const handleDeleteClick = () => {
    if (mode === 'edit' && profile && onDelete) {
      onDelete(profile.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#181B22] border border-[#2D3240] rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262A34]">
          <div>
            <h2 className="text-base font-semibold text-[#EDEFF5]">
              Settings · {mode === 'create' ? 'Profile, APIs & LLM' : profile?.personId || profile?.name}
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Configure session Natal Dump, REST endpoints, and choose between Gemini or Fable LLM adapters.
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

        {/* Settings Tabs */}
        <div className="px-5 pt-3 border-b border-[#262A34] flex items-center gap-2 bg-[#15181E]">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-[#D4A853] text-[#D4A853]'
                : 'border-transparent text-[#8E95A5] hover:text-[#EDEFF5]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Profile &amp; REST APIs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('llm')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'llm'
                ? 'border-[#D4A853] text-[#D4A853]'
                : 'border-transparent text-[#8E95A5] hover:text-[#EDEFF5]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>LLM Adapters (Gemini / Fable)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'profile' ? (
            <>
              {/* Profile Metadata + 5-7 Char personId */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#8E95A5]">
                      Profile ID (personId)
                    </label>
                    <span
                      className={`text-[10px] font-mono ${
                        personIdValid ? 'text-[#D4A853]' : 'text-[#8E95A5]'
                      }`}
                    >
                      5–7 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={7}
                    value={personId}
                    onChange={(e) => setPersonId(e.target.value.toUpperCase())}
                    placeholder="e.g., 001ME"
                    className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={roleLabel}
                    onChange={(e) => setRoleLabel(e.target.value)}
                    placeholder="e.g., Primary Chart"
                    className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-sm text-[#EDEFF5] placeholder-[#555C6E] outline-none"
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

                <div className="bg-[#181B22] border border-[#262A34] rounded-lg px-3 py-2 space-y-1 text-[11px] font-mono text-[#8E95A5]">
                  <div className="truncate">
                    <span className="text-[#D4A853]">GET Natal:</span> {resolvedNatalPreview}
                  </div>
                  <div className="truncate">
                    <span className="text-[#D4A853]">GET Transit:</span> {resolvedTransitPreview}
                  </div>
                </div>

                {fetchStatus && <p className="text-xs text-emerald-400">{fetchStatus}</p>}
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
                  rows={9}
                  value={natalDump}
                  onChange={(e) => setNatalDump(e.target.value)}
                  placeholder="Paste or fetch your plain-text natal dump here (D1–D144, Dasha–Bhukti, SAV/BAV)..."
                  className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg p-3.5 text-xs font-mono leading-relaxed text-[#D8DCE6] placeholder-[#555C6E] outline-none resize-y"
                />
              </div>
            </>
          ) : (
            /* TAB 2: LLM ADAPTERS (GEMINI & FABLE) */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E95A5] mb-2">
                  Select Active LLM Engine Adapter
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLlmProvider('gemini')}
                    className={`text-left rounded-xl p-4 border transition-colors ${
                      llmProvider === 'gemini'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]'
                        : 'bg-[#111318] border-[#262A34] hover:border-[#3A4152]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#EDEFF5]">Gemini Adapter</span>
                      <span className="text-[10px] font-mono text-[#D4A853]">
                        {llmProvider === 'gemini' ? 'ACTIVE' : 'SELECT'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-1">
                      Google @google/genai SDK using your server-side Gemini configuration.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLlmProvider('fable')}
                    className={`text-left rounded-xl p-4 border transition-colors ${
                      llmProvider === 'fable'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]'
                        : 'bg-[#111318] border-[#262A34] hover:border-[#3A4152]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#EDEFF5]">Fable Adapter</span>
                      <span className="text-[10px] font-mono text-[#D4A853]">
                        {llmProvider === 'fable' ? 'ACTIVE' : 'SELECT'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-1">
                      Connect your Fable LLM inference endpoint (OpenAI-compatible / chat completions).
                    </p>
                  </button>
                </div>
              </div>

              {llmProvider === 'gemini' ? (
                <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                      Gemini Model
                    </label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] outline-none"
                    >
                      <option value="gemini-4-hydrogen">gemini-4-hydrogen (Fast Reasoning)</option>
                      <option value="gemini-4-neon">gemini-4-neon (Complex Chart Synthesis)</option>
                      <option value="gemini-4-carbon">gemini-4-carbon (Deep Reasoning)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-[#8E95A5]">
                    Credentials are handled automatically by the server environment.
                  </p>
                </div>
              ) : (
                <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                      Fable Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={fableEndpointUrl}
                      onChange={(e) => setFableEndpointUrl(e.target.value)}
                      placeholder="https://your-fable-host/v1/chat/completions"
                      className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Fable Model Name
                      </label>
                      <input
                        type="text"
                        value={fableModel}
                        onChange={(e) => setFableModel(e.target.value)}
                        placeholder="fable-astro-1"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Fable Access Token (Optional)
                      </label>
                      <input
                        type="password"
                        value={fableApiKey}
                        onChange={(e) => setFableApiKey(e.target.value)}
                        placeholder="Bearer token"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262A34]">
            <div>
              {mode === 'edit' && profile && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="px-3.5 py-2 text-xs font-medium text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Profile ({profile.personId})</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
