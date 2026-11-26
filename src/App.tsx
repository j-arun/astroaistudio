import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import {
  AstroProfile,
  AstroThread,
  MagicCard,
  StudioApiConfig,
  ThreadMessage,
  TransitWindow,
} from './types/astro';
import {
  DEFAULT_PROFILES,
  buildSampleTransitDump,
  formatMonthRangeLabel,
  monthDiffInclusive,
  parseNatalDump,
} from './data/sampleProfiles';
import { KundaliChart } from './components/KundaliChart';
import { MagicCardDeck } from './components/MagicCardDeck';
import { OpenedCardSpread } from './components/OpenedCardSpread';
import { NatalConfigModal } from './components/NatalConfigModal';

const STORAGE_PROFILES_KEY = 'astro_studio_profiles_v1';
const STORAGE_THREADS_KEY = 'astro_studio_threads_v1';
const STORAGE_CONFIG_KEY = 'astro_studio_config_v1';

const DEFAULT_API_CONFIG: StudioApiConfig = {
  natalApiUrl: '',
  transitApiUrl: '',
  apiBearerToken: '',
};

function isValidYearMonth(val: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(val.trim());
}

function createInitialDraftThread(profile: AstroProfile): AstroThread {
  const parsed = parseNatalDump(profile.natalDump, profile.name);
  return {
    id: `thread-${Date.now()}`,
    profileId: profile.id,
    title: 'New Astro Reading',
    createdAt: new Date().toISOString(),
    step: 'narrative',
    narrativeWindow: {
      startMonth: '2026-06',
      endMonth: '2026-08',
      transitDump: buildSampleTransitDump('2026-06', '2026-08', parsed.moonSign, false),
    },
    cards: [],
    futureWindow: {
      startMonth: '2027-01',
      endMonth: '2027-02',
      transitDump: buildSampleTransitDump('2027-01', '2027-02', parsed.moonSign, true),
    },
    messages: [],
  };
}

export default function App() {
  const [profiles, setProfiles] = useState<AstroProfile[]>(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_PROFILES[0].id);
  const [apiConfig, setApiConfig] = useState<StudioApiConfig>(DEFAULT_API_CONFIG);
  const [savedThreads, setSavedThreads] = useState<AstroThread[]>([]);
  const [activeThread, setActiveThread] = useState<AstroThread>(() =>
    createInitialDraftThread(DEFAULT_PROFILES[0])
  );

  const [showInspector, setShowInspector] = useState(true);
  const [showTransitBoxes, setShowTransitBoxes] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create' | null>(null);
  const [customThreadTitle, setCustomThreadTitle] = useState('');

  const [fetchingPastTransit, setFetchingPastTransit] = useState(false);
  const [fetchingFutureTransit, setFetchingFutureTransit] = useState(false);
  const [transitFetchError, setTransitFetchError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Hydrate disk-backed Profiles, Threads, and API Config
  useEffect(() => {
    const loadInitialData = async () => {
      let loadedProfiles: AstroProfile[] | null = null;
      let loadedThreads: AstroThread[] | null = null;
      let loadedConfig: StudioApiConfig | null = null;

      try {
        const [pRes, tRes, cRes] = await Promise.all([
          fetch('/api/profiles'),
          fetch('/api/threads'),
          fetch('/api/config'),
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData.profiles) && pData.profiles.length > 0) {
            loadedProfiles = pData.profiles;
          }
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          if (Array.isArray(tData.threads)) {
            loadedThreads = tData.threads;
          }
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.config) {
            loadedConfig = cData.config;
          }
        }
      } catch {
        // Fallback to localStorage below
      }

      if (!loadedProfiles) {
        try {
          const localP = localStorage.getItem(STORAGE_PROFILES_KEY);
          if (localP) loadedProfiles = JSON.parse(localP);
        } catch {
          // ignore
        }
      }

      if (!loadedThreads) {
        try {
          const localT = localStorage.getItem(STORAGE_THREADS_KEY);
          if (localT) loadedThreads = JSON.parse(localT);
        } catch {
          // ignore
        }
      }

      if (!loadedConfig) {
        try {
          const localC = localStorage.getItem(STORAGE_CONFIG_KEY);
          if (localC) loadedConfig = JSON.parse(localC);
        } catch {
          // ignore
        }
      }

      const finalProfiles =
        loadedProfiles && loadedProfiles.length > 0 ? loadedProfiles : DEFAULT_PROFILES;
      setProfiles(finalProfiles);
      setActiveProfileId(finalProfiles[0].id);
      setActiveThread(createInitialDraftThread(finalProfiles[0]));

      if (loadedThreads) {
        setSavedThreads(loadedThreads);
      }
      if (loadedConfig) {
        setApiConfig(loadedConfig);
      }
    };

    loadInitialData();
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || profiles[0],
    [profiles, activeProfileId]
  );

  const parsedNatal = useMemo(
    () => parseNatalDump(activeProfile.natalDump, activeProfile.name),
    [activeProfile]
  );

  const profileThreads = useMemo(
    () => savedThreads.filter((t) => t.profileId === activeProfile.id),
    [savedThreads, activeProfile.id]
  );

  const persistProfiles = async (nextProfiles: AstroProfile[]) => {
    setProfiles(nextProfiles);
    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(nextProfiles));
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: nextProfiles }),
      });
    } catch {
      // local state updated
    }
  };

  const persistThreads = async (nextThreads: AstroThread[]) => {
    setSavedThreads(nextThreads);
    try {
      localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(nextThreads));
      await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: nextThreads }),
      });
    } catch {
      // local state updated
    }
  };

  const persistConfig = async (nextConfig: StudioApiConfig) => {
    setApiConfig(nextConfig);
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(nextConfig));
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig }),
      });
    } catch {
      // local state updated
    }
  };

  const handleSelectProfile = (profile: AstroProfile) => {
    setActiveProfileId(profile.id);
    setProfileMenuOpen(false);
    setActiveThread(createInitialDraftThread(profile));
    setCustomThreadTitle('');
    setAnalyzeError(null);
    setChatError(null);
    setTransitFetchError(null);
  };

  const handleSaveProfileModal = (updated: AstroProfile, nextConfig: StudioApiConfig) => {
    const exists = profiles.some((p) => p.id === updated.id);
    const next = exists
      ? profiles.map((p) => (p.id === updated.id ? updated : p))
      : [...profiles, updated];
    persistProfiles(next);
    persistConfig(nextConfig);
    setActiveProfileId(updated.id);
    if (!exists) {
      setActiveThread(createInitialDraftThread(updated));
    }
  };

  const handleStartNewThread = () => {
    setActiveThread(createInitialDraftThread(activeProfile));
    setCustomThreadTitle('');
    setAnalyzeError(null);
    setChatError(null);
    setTransitFetchError(null);
  };

  const handleSelectSavedThread = (thread: AstroThread) => {
    setActiveThread({ ...thread, step: 'reading' });
    setAnalyzeError(null);
    setChatError(null);
  };

  const handleDeleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = savedThreads.filter((t) => t.id !== id);
    persistThreads(next);
    if (activeThread.id === id) {
      handleStartNewThread();
    }
  };

  // Validate typed YYYY-MM 1-3 month windows
  const isNarrativeValid =
    isValidYearMonth(activeThread.narrativeWindow.startMonth) &&
    isValidYearMonth(activeThread.narrativeWindow.endMonth) &&
    monthDiffInclusive(
      activeThread.narrativeWindow.startMonth,
      activeThread.narrativeWindow.endMonth
    ) >= 1 &&
    monthDiffInclusive(
      activeThread.narrativeWindow.startMonth,
      activeThread.narrativeWindow.endMonth
    ) <= 3;

  const narrativeMonthsCount =
    isValidYearMonth(activeThread.narrativeWindow.startMonth) &&
    isValidYearMonth(activeThread.narrativeWindow.endMonth)
      ? monthDiffInclusive(
          activeThread.narrativeWindow.startMonth,
          activeThread.narrativeWindow.endMonth
        )
      : 0;

  const isFutureValid =
    isValidYearMonth(activeThread.futureWindow.startMonth) &&
    isValidYearMonth(activeThread.futureWindow.endMonth) &&
    monthDiffInclusive(
      activeThread.futureWindow.startMonth,
      activeThread.futureWindow.endMonth
    ) >= 1 &&
    monthDiffInclusive(
      activeThread.futureWindow.startMonth,
      activeThread.futureWindow.endMonth
    ) <= 3;

  const futureMonthsCount =
    isValidYearMonth(activeThread.futureWindow.startMonth) &&
    isValidYearMonth(activeThread.futureWindow.endMonth)
      ? monthDiffInclusive(
          activeThread.futureWindow.startMonth,
          activeThread.futureWindow.endMonth
        )
      : 0;

  const updateNarrativeWindow = (patch: Partial<TransitWindow>) => {
    setActiveThread((prev) => ({
      ...prev,
      narrativeWindow: { ...prev.narrativeWindow, ...patch },
    }));
  };

  const updateFutureWindow = (patch: Partial<TransitWindow>) => {
    setActiveThread((prev) => ({
      ...prev,
      futureWindow: { ...prev.futureWindow, ...patch },
    }));
  };

  // Call external Transit API and apply plain text into the Transit box
  const handleFetchTransitFromApi = async (mode: 'past' | 'future') => {
    setTransitFetchError(null);
    if (!apiConfig.transitApiUrl.trim()) {
      setTransitFetchError(
        'No Transit API URL configured yet. Click the gear icon in the left sidebar to set your Transit API endpoint, or paste plain text directly.'
      );
      setShowTransitBoxes(true);
      return;
    }

    const win =
      mode === 'past' ? activeThread.narrativeWindow : activeThread.futureWindow;
    if (mode === 'past') setFetchingPastTransit(true);
    else setFetchingFutureTransit(true);

    try {
      const res = await fetch('/api/external/fetch-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: apiConfig.transitApiUrl.trim(),
          method: 'POST',
          bearerToken: apiConfig.apiBearerToken,
          payload: {
            profileName: activeProfile.name,
            moonSign: parsedNatal.moonSign,
            startMonth: win.startMonth,
            endMonth: win.endMonth,
            windowType: mode,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch transit details.');
      }
      if (data.text) {
        if (mode === 'past') updateNarrativeWindow({ transitDump: data.text });
        else updateFutureWindow({ transitDump: data.text });
        setShowTransitBoxes(true);
      }
    } catch (err: unknown) {
      setTransitFetchError(
        err instanceof Error ? err.message : 'Unable to reach Transit API.'
      );
      setShowTransitBoxes(true);
    } finally {
      if (mode === 'past') setFetchingPastTransit(false);
      else setFetchingFutureTransit(false);
    }
  };

  // Unified Submit: Sends Session Natal (Fold 1) + Past Narrative & Cards (Fold 2) + Future Window (Fold 3)
  const handleSubmitThread = async () => {
    if (!isNarrativeValid || !isFutureValid || activeThread.cards.length === 0) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch('/api/astro/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: activeProfile.name,
          natalDump: activeProfile.natalDump,
          narrativeWindow: activeThread.narrativeWindow,
          cards: activeThread.cards,
          futureWindow: activeThread.futureWindow,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze Magic Cards.');
      }

      const readingsMap = new Map<
        string,
        {
          verdictSummary: string;
          planetaryTriggers: string;
          timingWindow: string;
          guidance: string;
        }
      >();
      if (Array.isArray(data.cardReadings)) {
        for (const r of data.cardReadings) {
          readingsMap.set(r.cardId, {
            verdictSummary: r.verdictSummary,
            planetaryTriggers: r.planetaryTriggers,
            timingWindow: r.timingWindow,
            guidance: r.guidance,
          });
        }
      }

      const enrichedCards: MagicCard[] = activeThread.cards.map((c) => ({
        ...c,
        reading: readingsMap.get(c.id),
      }));

      const autoTitle =
        customThreadTitle.trim() ||
        `${formatMonthRangeLabel(
          activeThread.narrativeWindow.startMonth,
          activeThread.narrativeWindow.endMonth
        )} → ${formatMonthRangeLabel(
          activeThread.futureWindow.startMonth,
          activeThread.futureWindow.endMonth
        )} · ${enrichedCards
          .map((c) => c.domain)
          .slice(0, 2)
          .join(' & ')}`;

      const completedThread: AstroThread = {
        ...activeThread,
        title: autoTitle,
        submittedAt: new Date().toISOString(),
        step: 'reading',
        cards: enrichedCards,
        overallSynthesis: data.overallSynthesis || '',
      };

      setActiveThread(completedThread);
      const withoutDup = savedThreads.filter((t) => t.id !== completedThread.id);
      persistThreads([completedThread, ...withoutDup]);
    } catch (err: unknown) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Unable to unfold readings. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Persistent 3-Fold Thread Follow-Up Chat
  const handleSendChat = async (userMessage: string) => {
    setChatError(null);
    const userMsg: ThreadMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...activeThread.messages, userMsg];
    const optimisticThread: AstroThread = {
      ...activeThread,
      messages: updatedHistory,
    };
    setActiveThread(optimisticThread);
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/astro/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: activeProfile.name,
          natalDump: activeProfile.natalDump,
          narrativeWindow: activeThread.narrativeWindow,
          cards: activeThread.cards,
          futureWindow: activeThread.futureWindow,
          history: activeThread.messages,
          userMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get follow-up answer.');
      }

      const aiMsg: ThreadMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };

      const finalThread: AstroThread = {
        ...optimisticThread,
        messages: [...updatedHistory, aiMsg],
      };

      setActiveThread(finalThread);
      const nextSaved = savedThreads.map((t) => (t.id === finalThread.id ? finalThread : t));
      if (!savedThreads.some((t) => t.id === finalThread.id)) {
        nextSaved.unshift(finalThread);
      }
      persistThreads(nextSaved);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Unable to send follow-up message.');
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111318] text-[#EDEFF5] flex">
      {/* LEFT SIDEBAR — PROFILE SESSION + SUBMITTED THREADS */}
      <aside className="w-[268px] shrink-0 bg-[#161920] border-r border-[#262A34] flex flex-col justify-between">
        <div className="p-3.5 space-y-3 border-b border-[#262A34]">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-display font-semibold tracking-tight text-[#EDEFF5]">
              Astro AI Studio
            </span>
            <button
              type="button"
              onClick={() => setModalMode('edit')}
              title="Configure Profile Natal Dump & External APIs"
              className="text-[#8E95A5] hover:text-[#EDEFF5] p-1 rounded transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          {/* Active Session Profile Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="w-full text-left bg-[#111318] hover:bg-[#14171E] border border-[#262A34] rounded-lg px-3 py-2.5 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#EDEFF5] truncate">
                  {activeProfile.name}
                </div>
                <div className="text-[11px] text-[#8E95A5] truncate mt-0.5">
                  {parsedNatal.moonSign.split('(')[0].trim()} Moon · Natal Loaded
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
            </button>

            {profileMenuOpen && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 bg-[#1B1F28] border border-[#2D3240] rounded-lg overflow-hidden shadow-xl">
                <div className="py-1">
                  {profiles.map((p) => {
                    const pParsed = parseNatalDump(p.natalDump, p.name);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProfile(p)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                          p.id === activeProfile.id
                            ? 'bg-[#D4A853]/10 text-[#D4A853]'
                            : 'text-[#EDEFF5] hover:bg-[#242936]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-[10px] text-[#8E95A5] truncate">
                            {pParsed.moonSign.split('(')[0].trim()} · {p.roleLabel}
                          </div>
                        </div>
                        {p.id === activeProfile.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[#262A34] p-1.5 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setModalMode('edit');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#B9C0D0] hover:text-[#EDEFF5] hover:bg-[#242936] rounded transition-colors"
                  >
                    Configure Natal &amp; APIs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setModalMode('create');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#D4A853] hover:bg-[#242936] rounded transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Disk Profile
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleStartNewThread}
            className="w-full py-2 px-3 bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Reading Thread
          </button>
        </div>

        {/* Submitted Threads List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-medium text-[#6C7384]">
            <span>Threads</span>
            <span className="font-mono tabular-nums">{profileThreads.length}</span>
          </div>

          {profileThreads.length === 0 ? (
            <div className="px-2.5 py-6 text-center border border-dashed border-[#262A34] rounded-lg mx-1">
              <p className="text-xs text-[#8E95A5] leading-relaxed">
                Complete your narrative cards &amp; timelines, then click Submit—the finished thread appears here with its name, date, and time.
              </p>
            </div>
          ) : (
            profileThreads.map((t) => {
              const isSelected = activeThread.id === t.id;
              const dt = new Date(t.submittedAt || t.createdAt);
              const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectSavedThread(t)}
                  className={`group cursor-pointer rounded-lg px-2.5 py-2.5 transition-colors border ${
                    isSelected
                      ? 'bg-[#222631] border-[#343A4A]'
                      : 'bg-transparent border-transparent hover:bg-[#1B1F28]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-xs font-medium leading-snug line-clamp-1 ${
                        isSelected ? 'text-[#EDEFF5]' : 'text-[#C8CEDB]'
                      }`}
                    >
                      {t.title}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteThread(e, t.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#6C7384] hover:text-red-400 transition-opacity shrink-0"
                      title="Delete thread"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-[#6C7384] mt-1">
                    <span>{dateStr}</span>
                    <span>·</span>
                    <span>{timeStr}</span>
                    <span>·</span>
                    <span className="text-[#D4A853]/80">{t.cards.length} cards</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Session Natal Status Footer */}
        <div className="px-4 py-2.5 border-t border-[#262A34] text-[11px] text-[#6C7384] flex items-center justify-between">
          <span>Session Natal Active</span>
          <span className="font-mono tabular-nums text-[#8E95A5]">
            {parsedNatal.tokenEstimate.toLocaleString()} tok
          </span>
        </div>
      </aside>

      {/* CENTER WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col bg-[#111318]">
        {/* Clean 2-Phase Thread Header */}
        <header className="h-14 shrink-0 border-b border-[#262A34] px-5 flex items-center justify-between gap-4 bg-[#14171D]">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() =>
                !activeThread.submittedAt &&
                setActiveThread((prev) => ({ ...prev, step: 'narrative' }))
              }
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeThread.step === 'narrative'
                  ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/40'
                  : 'text-[#8E95A5]'
              }`}
            >
              <span className="font-mono text-[10px]">01.</span>
              <span>Narrative &amp; Magic Cards</span>
            </button>

            <span className="text-[#363C4A] text-xs select-none">→</span>

            <button
              type="button"
              disabled={!activeThread.submittedAt}
              onClick={() =>
                activeThread.submittedAt &&
                setActiveThread((prev) => ({ ...prev, step: 'reading' }))
              }
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeThread.step === 'reading'
                  ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/40'
                  : 'text-[#555C6E] cursor-not-allowed'
              }`}
            >
              <span className="font-mono text-[10px]">02.</span>
              <span>Unfolded Reading &amp; Thread</span>
              {!activeThread.submittedAt && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalMode('edit')}
              className="px-2.5 py-1.5 text-xs font-medium text-[#B9C0D0] hover:text-[#EDEFF5] border border-[#262A34] rounded-md whitespace-nowrap shrink-0 transition-colors"
            >
              Profile &amp; APIs
            </button>
            <button
              type="button"
              onClick={() => setShowInspector((v) => !v)}
              className="px-2.5 py-1.5 text-xs font-medium text-[#B9C0D0] hover:text-[#EDEFF5] border border-[#262A34] rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {showInspector ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hide Chart</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Show Chart</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {activeThread.step === 'narrative' && (
              <>
                {/* TIMELINES & TRANSITS BAR (TYPED MONTHS + API FETCH) */}
                <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262A34] pb-3">
                    <div>
                      <h1 className="text-base font-semibold text-[#EDEFF5] tracking-tight">
                        Set Past Narrative &amp; Future Target Timelines
                      </h1>
                      <p className="text-xs text-[#8E95A5] mt-0.5">
                        Type <span className="font-mono text-[#EDEFF5]">YYYY-MM</span> ranges (1–3 months max each). Natal data for{' '}
                        <span className="text-[#D4A853] font-medium">{activeProfile.name}</span> is already locked in for this session.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTransitBoxes((v) => !v)}
                      className="px-2.5 py-1.5 text-xs font-medium text-[#B9C0D0] hover:text-[#EDEFF5] bg-[#111318] border border-[#262A34] rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <span>{showTransitBoxes ? 'Hide Transit Dumps' : 'View / Edit Transit Dumps'}</span>
                      {showTransitBoxes ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Typed Month Range Inputs */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Past Narrative Months */}
                    <div className="lg:col-span-5 bg-[#111318] border border-[#262A34] rounded-lg p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#EDEFF5]">
                          Past Narrative Period
                        </span>
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isNarrativeValid ? 'text-[#D4A853]' : 'text-red-400'
                          }`}
                        >
                          {narrativeMonthsCount > 0 ? `${narrativeMonthsCount}/3 mo` : 'Invalid'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#8E95A5] mb-1">
                            Start (YYYY-MM)
                          </label>
                          <input
                            type="text"
                            value={activeThread.narrativeWindow.startMonth}
                            onChange={(e) => updateNarrativeWindow({ startMonth: e.target.value })}
                            placeholder="2026-06"
                            className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#EDEFF5] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8E95A5] mb-1">
                            End (YYYY-MM)
                          </label>
                          <input
                            type="text"
                            value={activeThread.narrativeWindow.endMonth}
                            onChange={(e) => updateNarrativeWindow({ endMonth: e.target.value })}
                            placeholder="2026-08"
                            className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#EDEFF5] outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-[#6C7384]">
                          {isNarrativeValid
                            ? formatMonthRangeLabel(
                                activeThread.narrativeWindow.startMonth,
                                activeThread.narrativeWindow.endMonth
                              )
                            : 'Must be 1–3 months'}
                        </span>
                        <button
                          type="button"
                          disabled={!isNarrativeValid || fetchingPastTransit}
                          onClick={() => handleFetchTransitFromApi('past')}
                          className="text-[11px] text-[#D4A853] hover:text-[#DFB96B] flex items-center gap-1 disabled:opacity-40"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${fetchingPastTransit ? 'animate-spin' : ''}`}
                          />
                          <span>Fetch Transit API</span>
                        </button>
                      </div>
                    </div>

                    <div className="hidden lg:flex lg:col-span-1 items-center justify-center pt-9 text-[#555C6E]">
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Future Target Months */}
                    <div className="lg:col-span-6 bg-[#111318] border border-[#262A34] rounded-lg p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#EDEFF5]">
                          Future Target Period
                        </span>
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isFutureValid ? 'text-[#D4A853]' : 'text-red-400'
                          }`}
                        >
                          {futureMonthsCount > 0 ? `${futureMonthsCount}/3 mo` : 'Invalid'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#8E95A5] mb-1">
                            Start (YYYY-MM)
                          </label>
                          <input
                            type="text"
                            value={activeThread.futureWindow.startMonth}
                            onChange={(e) => updateFutureWindow({ startMonth: e.target.value })}
                            placeholder="2027-01"
                            className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#EDEFF5] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8E95A5] mb-1">
                            End (YYYY-MM)
                          </label>
                          <input
                            type="text"
                            value={activeThread.futureWindow.endMonth}
                            onChange={(e) => updateFutureWindow({ endMonth: e.target.value })}
                            placeholder="2027-02"
                            className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#EDEFF5] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8E95A5] mb-1">
                            Thread Name
                          </label>
                          <input
                            type="text"
                            value={customThreadTitle}
                            onChange={(e) => setCustomThreadTitle(e.target.value)}
                            placeholder="Optional"
                            className="w-full bg-[#181B22] border border-[#262A34] focus:border-[#D4A853] rounded px-2.5 py-1.5 text-xs text-[#EDEFF5] placeholder-[#555C6E] outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-[#6C7384]">
                          {isFutureValid
                            ? formatMonthRangeLabel(
                                activeThread.futureWindow.startMonth,
                                activeThread.futureWindow.endMonth
                              )
                            : 'Must be 1–3 months'}
                        </span>
                        <button
                          type="button"
                          disabled={!isFutureValid || fetchingFutureTransit}
                          onClick={() => handleFetchTransitFromApi('future')}
                          className="text-[11px] text-[#D4A853] hover:text-[#DFB96B] flex items-center gap-1 disabled:opacity-40"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${fetchingFutureTransit ? 'animate-spin' : ''}`}
                          />
                          <span>Fetch Transit API</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {transitFetchError && (
                    <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg px-3.5 py-2 text-xs text-amber-200">
                      {transitFetchError}
                    </div>
                  )}

                  {/* Expandable Plain-Text Transit Dumps */}
                  {showTransitBoxes && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[#262A34]">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-[#8E95A5]">
                            Past Window Plain-Text Transits
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateNarrativeWindow({
                                transitDump: buildSampleTransitDump(
                                  activeThread.narrativeWindow.startMonth,
                                  activeThread.narrativeWindow.endMonth,
                                  parsedNatal.moonSign,
                                  false
                                ),
                              })
                            }
                            className="text-[11px] text-[#D4A853] hover:text-[#DFB96B]"
                          >
                            Apply Sample
                          </button>
                        </div>
                        <textarea
                          rows={5}
                          value={activeThread.narrativeWindow.transitDump}
                          onChange={(e) => updateNarrativeWindow({ transitDump: e.target.value })}
                          className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg p-3 text-xs font-mono leading-relaxed text-[#D8DCE6] outline-none resize-y"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-[#8E95A5]">
                            Future Window Plain-Text Transits
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateFutureWindow({
                                transitDump: buildSampleTransitDump(
                                  activeThread.futureWindow.startMonth,
                                  activeThread.futureWindow.endMonth,
                                  parsedNatal.moonSign,
                                  true
                                ),
                              })
                            }
                            className="text-[11px] text-[#D4A853] hover:text-[#DFB96B]"
                          >
                            Apply Sample
                          </button>
                        </div>
                        <textarea
                          rows={5}
                          value={activeThread.futureWindow.transitDump}
                          onChange={(e) => updateFutureWindow({ transitDump: e.target.value })}
                          className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg p-3 text-xs font-mono leading-relaxed text-[#D8DCE6] outline-none resize-y"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {analyzeError && (
                  <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3 text-xs text-red-300">
                    {analyzeError}
                  </div>
                )}

                {/* MAGIC CARD BUILDER + TRAY + SINGLE SUBMIT */}
                <MagicCardDeck
                  startMonth={activeThread.narrativeWindow.startMonth}
                  endMonth={activeThread.narrativeWindow.endMonth}
                  isRangeValid={isNarrativeValid}
                  isFutureValid={isFutureValid}
                  isSubmitting={isAnalyzing}
                  cards={activeThread.cards}
                  onChangeCards={(cards) => setActiveThread((prev) => ({ ...prev, cards }))}
                  onSubmitThread={handleSubmitThread}
                />
              </>
            )}

            {/* FOLD 3 UNFOLDED: OPENED SPREAD + FLOWING CHAT */}
            {activeThread.step === 'reading' && (
              <OpenedCardSpread
                thread={activeThread}
                isSendingChat={isSendingChat}
                chatError={chatError}
                onSendChat={handleSendChat}
              />
            )}
          </div>
        </div>
      </main>

      {/* RIGHT INSPECTOR — SESSION NATAL CHART & 3-FOLD BRIDGE */}
      {showInspector && (
        <aside className="hidden lg:flex w-[340px] shrink-0 bg-[#161920] border-l border-[#262A34] flex-col overflow-y-auto p-4 space-y-5">
          <KundaliChart natal={parsedNatal} />

          <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3.5 space-y-1.5">
            <div className="text-[11px] font-mono text-[#6C7384]">ACTIVE VIMSHOTTARI DASHA</div>
            <div className="text-xs font-medium text-[#EDEFF5] leading-snug">
              {parsedNatal.currentDasha}
            </div>
            <div className="text-[11px] text-[#8E95A5]">{parsedNatal.nakshatra}</div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#EDEFF5]">
              <span>Session 3-Fold Payload</span>
              <Clock className="w-3.5 h-3.5 text-[#D4A853]" />
            </div>

            <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#D4A853]">FOLD 1 · SESSION NATAL</span>
                <span className="font-mono tabular-nums text-[#8E95A5]">Active</span>
              </div>
              <p className="text-xs text-[#C8CEDB] mt-1">
                {activeProfile.name} · D1–D144 + SAV ({parsedNatal.savTotal})
              </p>
            </div>

            <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#D4A853]">FOLD 2 · NARRATIVE + CARDS</span>
                <span className="font-mono tabular-nums text-[#8E95A5]">
                  {activeThread.cards.length} cards
                </span>
              </div>
              <p className="text-xs text-[#C8CEDB] mt-1">
                {isNarrativeValid
                  ? formatMonthRangeLabel(
                      activeThread.narrativeWindow.startMonth,
                      activeThread.narrativeWindow.endMonth
                    )
                  : activeThread.narrativeWindow.startMonth}
              </p>
              {activeThread.cards.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-[#262A34] pt-2">
                  {activeThread.cards.map((c, i) => (
                    <div key={c.id} className="text-[11px] text-[#8E95A5] truncate">
                      <span className="font-mono text-[#D4A853]">#{i + 1}</span> {c.domain} ·{' '}
                      {c.title}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#111318] border border-[#262A34] rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#D4A853]">FOLD 3 · TARGET FUTURE</span>
                <span className="font-mono tabular-nums text-[#8E95A5]">
                  {activeThread.submittedAt ? 'Unfolded' : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-[#C8CEDB] mt-1">
                {isFutureValid
                  ? formatMonthRangeLabel(
                      activeThread.futureWindow.startMonth,
                      activeThread.futureWindow.endMonth
                    )
                  : activeThread.futureWindow.startMonth}
              </p>
            </div>
          </div>
        </aside>
      )}

      {modalMode && (
        <NatalConfigModal
          isOpen={Boolean(modalMode)}
          mode={modalMode}
          profile={activeProfile}
          apiConfig={apiConfig}
          onClose={() => setModalMode(null)}
          onSave={handleSaveProfileModal}
        />
      )}
    </div>
  );
}
