import React, { useState } from 'react';
import { CheckCircle2, Cpu, Globe, RefreshCw, Trash2, X, Zap } from 'lucide-react';
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
  const [fableModel, setFableModel] = useState(apiConfig.fableModel || '');
  const [fableApiKey, setFableApiKey] = useState(apiConfig.fableApiKey || '');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    apiConfig.ollamaBaseUrl || 'http://localhost:11434'
  );
  const [ollamaModel, setOllamaModel] = useState(apiConfig.ollamaModel || 'qwen2.5:latest');
  const [discoveredOllamaModels, setDiscoveredOllamaModels] = useState<string[]>([]);
  const [discoveringOllama, setDiscoveringOllama] = useState(false);

  const [isFetchingNatal, setIsFetchingNatal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);

  const [testingProvider, setTestingProvider] = useState<LlmProvider | null>(null);
  const [adapterTestResult, setAdapterTestResult] = useState<{
    ok: boolean;
    provider: LlmProvider;
    message: string;
  } | null>(null);

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
    fableModel: fableModel.trim(),
    fableApiKey: fableApiKey.trim(),
    ollamaBaseUrl: ollamaBaseUrl.trim() || 'http://localhost:11434',
    ollamaModel: ollamaModel.trim() || 'qwen2.5:latest',
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

  const handleDiscoverOllamaModels = async () => {
    setDiscoveringOllama(true);
    setAdapterTestResult(null);
    try {
      const res = await fetch('/api/astro/ollama-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollamaBaseUrl: ollamaBaseUrl.trim() || 'http://localhost:11434',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to discover Ollama models.');
      }
      const list: string[] = Array.isArray(data.models) ? data.models : [];
      setDiscoveredOllamaModels(list);
      if (list.length > 0 && !list.includes(ollamaModel.trim())) {
        const qwenFirst = list.find((m) => /qwen/i.test(m)) || list[0];
        setOllamaModel(qwenFirst);
      }
      setAdapterTestResult({
        ok: true,
        provider: 'ollama',
        message:
          list.length > 0
            ? `Discovered ${list.length} model(s) at ${data.baseUrl}: ${list.join(', ')}`
            : `Connected to ${data.baseUrl}, but no models were returned by /api/tags.`,
      });
    } catch (err: unknown) {
      setAdapterTestResult({
        ok: false,
        provider: 'ollama',
        message: err instanceof Error ? err.message : 'Unable to discover Ollama models.',
      });
    } finally {
      setDiscoveringOllama(false);
    }
  };

  const handleTestAdapter = async (target: LlmProvider) => {
    setTestingProvider(target);
    setAdapterTestResult(null);

    try {
      const res = await fetch('/api/astro/test-adapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: target,
          geminiModel: geminiModel.trim() || 'gemini-4-hydrogen',
          fableEndpointUrl: fableEndpointUrl.trim(),
          fableModel: fableModel.trim(),
          fableApiKey: fableApiKey.trim(),
          ollamaBaseUrl: ollamaBaseUrl.trim() || 'http://localhost:11434',
          ollamaModel: ollamaModel.trim() || 'qwen2.5:latest',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `${target} adapter test failed.`);
      }
      setAdapterTestResult({
        ok: true,
        provider: target,
        message: `Connected (${data.model}) in ${data.latencyMs}ms · Reply: "${data.reply}"`,
      });
    } catch (err: unknown) {
      setAdapterTestResult({
        ok: false,
        provider: target,
        message: err instanceof Error ? err.message : `${target} adapter test failed.`,
      });
    } finally {
      setTestingProvider(null);
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
      setFetchError('Enter your Fable Adapter Endpoint URL or switch to another adapter.');
      return;
    }
    if (llmProvider === 'ollama' && (!ollamaBaseUrl.trim() || !ollamaModel.trim())) {
      setActiveTab('llm');
      setFetchError('Enter your Ollama Base URL and Model name (e.g., qwen2.5:14b).');
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
              Configure session Natal Dump, REST endpoints, and choose between Gemini, Fable, or Private LLM (Ollama).
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
            <span>LLM Adapters (Gemini / Fable / Private Ollama)</span>
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
            /* TAB 2: LLM ADAPTERS (GEMINI, FABLE & PRIVATE OLLAMA) */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E95A5] mb-2">
                  Select Active LLM Engine Adapter
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setLlmProvider('gemini')}
                    className={`text-left rounded-xl p-4 border transition-colors ${
                      llmProvider === 'gemini'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]'
                        : 'bg-[#111318] border-[#262A34] hover:border-[#3A4152]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#EDEFF5]">Gemini</span>
                      <span className="text-[10px] font-mono text-[#D4A853]">
                        {llmProvider === 'gemini' ? 'ACTIVE' : 'PUBLIC'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-1">
                      Public Google @google/genai SDK via server environment.
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#EDEFF5]">Fable</span>
                      <span className="text-[10px] font-mono text-[#D4A853]">
                        {llmProvider === 'fable' ? 'ACTIVE' : 'CLOUD'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-1">
                      Cloud-hosted Fable (e.g. Fable 5.2 / OpenAI-compatible endpoint).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLlmProvider('ollama')}
                    className={`text-left rounded-xl p-4 border transition-colors ${
                      llmProvider === 'ollama'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]'
                        : 'bg-[#111318] border-[#262A34] hover:border-[#3A4152]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#EDEFF5]">Private LLM</span>
                      <span className="text-[10px] font-mono text-[#D4A853]">
                        {llmProvider === 'ollama' ? 'ACTIVE' : 'OLLAMA'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-1">
                      Ollama-hosted Qwen or local model running on your laptop.
                    </p>
                  </button>
                </div>
              </div>

              {llmProvider === 'gemini' ? (
                <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-[#8E95A5]">
                      Gemini Model
                    </label>
                    <button
                      type="button"
                      disabled={testingProvider !== null}
                      onClick={() => handleTestAdapter('gemini')}
                      className="px-3 py-1.5 rounded-md bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-50 text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Zap className={`w-3.5 h-3.5 ${testingProvider === 'gemini' ? 'animate-pulse' : ''}`} />
                      <span>{testingProvider === 'gemini' ? 'Testing Gemini...' : 'Test Gemini Adapter'}</span>
                    </button>
                  </div>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] outline-none"
                  >
                    <option value="gemini-4-hydrogen">gemini-4-hydrogen (Fast Reasoning)</option>
                    <option value="gemini-4-neon">gemini-4-neon (Complex Synthesis)</option>
                    <option value="gemini-4-carbon">gemini-4-carbon (Deep Reasoning)</option>
                  </select>
                  <p className="text-[11px] text-[#8E95A5]">
                    Credentials are handled automatically by the server environment.
                  </p>
                </div>
              ) : llmProvider === 'fable' ? (
                <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#EDEFF5]">
                      Fable / Anthropic Endpoint
                    </span>
                    <button
                      type="button"
                      disabled={testingProvider !== null}
                      onClick={() => handleTestAdapter('fable')}
                      className="px-3 py-1.5 rounded-md bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-50 text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Zap className={`w-3.5 h-3.5 ${testingProvider === 'fable' ? 'animate-pulse' : ''}`} />
                      <span>{testingProvider === 'fable' ? 'Testing Fable...' : 'Test Fable Adapter'}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                      Fable Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={fableEndpointUrl}
                      onChange={(e) => setFableEndpointUrl(e.target.value)}
                      placeholder="https://api.anthropic.com/v1/messages"
                      className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Model ID (Your Endpoint&apos;s Model Name)
                      </label>
                      <input
                        type="text"
                        value={fableModel}
                        onChange={(e) => setFableModel(e.target.value)}
                        placeholder="e.g., claude-sonnet-4-20250514"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        API Key (x-api-key / Bearer)
                      </label>
                      <input
                        type="password"
                        value={fableApiKey}
                        onChange={(e) => setFableApiKey(e.target.value)}
                        placeholder="sk-ant-... (or set in Secrets)"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#111318] border border-[#262A34] rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#EDEFF5]">
                      Private LLM · Ollama Hosted (Qwen / Local)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={discoveringOllama || testingProvider !== null}
                        onClick={handleDiscoverOllamaModels}
                        className="px-3 py-1.5 rounded-md border border-[#2E3442] bg-[#181B22] hover:bg-[#1E222B] disabled:opacity-50 text-[#EDEFF5] text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-[#D4A853] ${
                            discoveringOllama ? 'animate-spin' : ''
                          }`}
                        />
                        <span>{discoveringOllama ? 'Discovering...' : 'Discover Models'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={testingProvider !== null || discoveringOllama}
                        onClick={() => handleTestAdapter('ollama')}
                        className="px-3 py-1.5 rounded-md bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-50 text-[#111318] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Zap
                          className={`w-3.5 h-3.5 ${
                            testingProvider === 'ollama' ? 'animate-pulse' : ''
                          }`}
                        />
                        <span>
                          {testingProvider === 'ollama' ? 'Testing Ollama...' : 'Test Ollama'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Ollama Base URL
                      </label>
                      <input
                        type="url"
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                        Ollama Model Name (e.g., Qwen)
                      </label>
                      <input
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        placeholder="e.g., qwen2.5:14b or qwen3:8b"
                        className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                      />
                    </div>
                  </div>

                  {discoveredOllamaModels.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-medium text-[#8E95A5]">
                        Discovered Local Models (Click to Select)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {discoveredOllamaModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setOllamaModel(m)}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors ${
                              ollamaModel.trim() === m
                                ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#D4A853]'
                                : 'border-[#262A34] bg-[#181B22] text-[#B9C0D0] hover:border-[#3A4152] hover:text-[#EDEFF5]'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                    Use <span className="font-mono text-[#EDEFF5]">http://localhost:11434</span> when running locally on your laptop, or an HTTPS tunnel / Tailscale URL if connecting from a remote cloud preview.
                  </p>
                </div>
              )}

              {adapterTestResult && (
                <div
                  className={`rounded-xl border px-4 py-3 text-xs flex items-start gap-2 ${
                    adapterTestResult.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/40 bg-red-950/30 text-red-300'
                  }`}
                >
                  {adapterTestResult.ok && (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-semibold uppercase tracking-wider text-[11px]">
                      {adapterTestResult.provider === 'gemini'
                        ? 'Gemini Adapter Test'
                        : adapterTestResult.provider === 'fable'
                        ? 'Fable Adapter Test'
                        : 'Private Ollama Adapter Test'}
                    </div>
                    <div>{adapterTestResult.message}</div>
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
