import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  AstroProfile,
  AstroThread,
  CardReading,
  LlmProvider,
  MagicCard,
  StudioApiConfig,
  ThreadMessage,
  TransitWindow,
} from './types/astro';
import {
  DEFAULT_PROFILES,
  MONTH_YEAR_OPTIONS,
  buildSampleTransitDump,
  formatMonthRangeLabel,
  formatYearMonthToLongLabel,
  isValidPersonId,
  monthDiffInclusive,
  parseNatalDump,
} from './data/sampleProfiles';
import { MagicCardDeck } from './components/MagicCardDeck';
import { OpenedCardSpread } from './components/OpenedCardSpread';
import { NatalConfigModal } from './components/NatalConfigModal';
import { buildAnalyzePromptParts } from './data/promptBuilder';
import { getCardTheme } from './data/cardThemes';

const STORAGE_PROFILES_KEY = 'astro_studio_profiles_v2';
const STORAGE_THREADS_KEY = 'astro_studio_threads_v2';
const STORAGE_CONFIG_KEY = 'astro_studio_config_v2';

const LEGACY_SEEDED_IDS = new Set(['profile-arun', 'profile-meera']);

const STORAGE_SIDEBAR_WIDTH_KEY = 'astro_studio_sidebar_width_v1';
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 460;
const DEFAULT_SIDEBAR_WIDTH = 272;

const DEFAULT_API_CONFIG: StudioApiConfig = {
  baseApiUrl: '',
  natalEndpointPath: '/api/natal/dump',
  transitEndpointPath: '/api/transit/dump',
  apiBearerToken: '',
  llmProvider: 'gemini',
  geminiModel: 'gemini-4-hydrogen',
  fableEndpointUrl: '',
  fableModel: '',
  fableApiKey: '',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:latest',
};

function createInitialDraftThread(profile: AstroProfile | null): AstroThread {
  const parsed = profile ? parseNatalDump(profile.natalDump, profile.name) : null;
  const moonSign = parsed?.moonSign || 'Moon Sign';
  return {
    id: `thread-${Date.now()}`,
    profileId: profile?.id || '',
    title: 'New Thread',
    createdAt: new Date().toISOString(),
    step: 'narrative',
    narrativeWindow: {
      startMonth: '2026-06',
      endMonth: '2026-08',
      transitDump: buildSampleTransitDump('2026-06', '2026-08', moonSign, false),
    },
    cards: [],
    futureWindow: {
      startMonth: '2027-01',
      endMonth: '2027-02',
      transitDump: buildSampleTransitDump('2027-01', '2027-02', moonSign, true),
    },
    messages: [],
  };
}

export default function App() {
  const [profiles, setProfiles] = useState<AstroProfile[]>(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [apiConfig, setApiConfig] = useState<StudioApiConfig>(DEFAULT_API_CONFIG);
  const [savedThreads, setSavedThreads] = useState<AstroThread[]>([]);
  const [activeThread, setActiveThread] = useState<AstroThread>(() =>
    createInitialDraftThread(null)
  );

  // Sequential step gating inside a New Thread:
  // 1) Set Past Narrative Period -> 2) Set Future Target Period -> 3) Magic Card (1 per thread)
  const [pastSet, setPastSet] = useState(false);
  const [futureSet, setFutureSet] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(saved) && saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH) {
        return saved;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create' | null>(null);

  const [settingPast, setSettingPast] = useState(false);
  const [settingFuture, setSettingFuture] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isPostingToPrivateLlm, setIsPostingToPrivateLlm] = useState(false);
  const [privateLlmError, setPrivateLlmError] = useState<string | null>(null);
  const [isUpdatingFollowUpWindow, setIsUpdatingFollowUpWindow] = useState(false);
  const [followUpWindowError, setFollowUpWindowError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedChatRequest, setFailedChatRequest] = useState<{
    userMessage: string;
    targetProvider: LlmProvider;
    userMsgId: string;
  } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showFullPromptPreview, setShowFullPromptPreview] = useState(false);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handlePointerMove = (e: PointerEvent) => {
      const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
      setSidebarWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const loadInitialData = async () => {
      let loadedProfiles: AstroProfile[] | null = null;
      let loadedThreads: AstroThread[] | null = null;
      let loadedConfig: Partial<StudioApiConfig> | null = null;

      try {
        const [pRes, tRes, cRes] = await Promise.all([
          fetch('/api/profiles'),
          fetch('/api/threads'),
          fetch('/api/config'),
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData.profiles)) loadedProfiles = pData.profiles;
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          if (Array.isArray(tData.threads)) loadedThreads = tData.threads;
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.config) loadedConfig = cData.config;
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

      const cleanedProfiles = (loadedProfiles || []).filter(
        (p) => !LEGACY_SEEDED_IDS.has(p.id)
      );
      setProfiles(cleanedProfiles);
      const firstProfile = cleanedProfiles[0] || null;
      setActiveProfileId(firstProfile?.id || '');
      setActiveThread(createInitialDraftThread(firstProfile));

      if (loadedThreads) {
        setSavedThreads(
          loadedThreads.filter((t) => !LEGACY_SEEDED_IDS.has(t.profileId))
        );
      }
      if (loadedConfig) {
        setApiConfig({ ...DEFAULT_API_CONFIG, ...loadedConfig });
      }
    };

    loadInitialData();
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  const parsedNatal = useMemo(
    () =>
      activeProfile
        ? parseNatalDump(activeProfile.natalDump, activeProfile.name)
        : null,
    [activeProfile]
  );

  const profileThreads = useMemo(
    () =>
      activeProfile
        ? savedThreads.filter((t) => t.profileId === activeProfile.id)
        : [],
    [savedThreads, activeProfile]
  );

  const fullConsultingPrompt = useMemo(() => {
    if (!activeProfile) return null;
    return buildAnalyzePromptParts({
      profileName: activeProfile.name,
      natalDump: activeProfile.natalDump,
      narrativeWindow: activeThread.narrativeWindow,
      cards: activeThread.cards,
      futureWindow: activeThread.futureWindow,
    });
  }, [
    activeProfile,
    activeThread.narrativeWindow,
    activeThread.cards,
    activeThread.futureWindow,
  ]);

  const handleCopyFullPrompt = async () => {
    if (!fullConsultingPrompt) return;
    const textToCopy = fullConsultingPrompt.fullCombinedPrompt;
    let copied = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2200);
    }
  };

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

  const resetThreadFlow = (profile: AstroProfile | null) => {
    setActiveThread(createInitialDraftThread(profile));
    setPastSet(false);
    setFutureSet(false);
    setTimelineError(null);
    setAnalyzeError(null);
    setPrivateLlmError(null);
    setFollowUpWindowError(null);
    setChatError(null);
    setFailedChatRequest(null);
  };

  const handleSelectProfile = (profile: AstroProfile) => {
    setActiveProfileId(profile.id);
    setProfileMenuOpen(false);
    resetThreadFlow(profile);
  };

  const handleSaveProfileModal = (updated: AstroProfile, nextConfig: StudioApiConfig) => {
    const exists = profiles.some((p) => p.id === updated.id);
    const next = exists
      ? profiles.map((p) => (p.id === updated.id ? updated : p))
      : [...profiles, updated];
    persistProfiles(next);
    persistConfig(nextConfig);
    setActiveProfileId(updated.id);
    if (!exists || !activeProfile) {
      resetThreadFlow(updated);
    }
  };

  const handleDeleteProfile = (profileId: string) => {
    const remaining = profiles.filter((p) => p.id !== profileId);
    const remainingThreads = savedThreads.filter((t) => t.profileId !== profileId);
    persistProfiles(remaining);
    persistThreads(remainingThreads);
    setProfileMenuOpen(false);

    if (activeProfileId === profileId) {
      const nextProfile = remaining[0] || null;
      setActiveProfileId(nextProfile?.id || '');
      resetThreadFlow(nextProfile);
    }
  };

  const handleStartNewThread = () => {
    if (!activeProfile) {
      setModalMode('create');
      return;
    }
    resetThreadFlow(activeProfile);
  };

  const handleSelectSavedThread = (thread: AstroThread) => {
    setActiveThread({ ...thread, step: 'reading' });
    setPastSet(true);
    setFutureSet(true);
    setAnalyzeError(null);
    setPrivateLlmError(null);
    setFollowUpWindowError(null);
    setChatError(null);
    setFailedChatRequest(null);
  };

  const handleDeleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = savedThreads.filter((t) => t.id !== id);
    persistThreads(next);
    if (activeThread.id === id) {
      handleStartNewThread();
    }
  };

  // Validate 1-3 month spans
  const narrativeMonthsCount = monthDiffInclusive(
    activeThread.narrativeWindow.startMonth,
    activeThread.narrativeWindow.endMonth
  );
  const isNarrativeValid = narrativeMonthsCount >= 1 && narrativeMonthsCount <= 3;

  const futureMonthsCount = monthDiffInclusive(
    activeThread.futureWindow.startMonth,
    activeThread.futureWindow.endMonth
  );
  const isFutureValid = futureMonthsCount >= 1 && futureMonthsCount <= 3;

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

  // Click "Set" on Past or Future Period -> fetch transit details if Base API URL configured, then advance stage
  const handleSetPeriod = async (mode: 'past' | 'future') => {
    if (!activeProfile) return;
    setTimelineError(null);

    const valid = mode === 'past' ? isNarrativeValid : isFutureValid;
    if (!valid) {
      setTimelineError(
        `${mode === 'past' ? 'Past Narrative' : 'Future Target'} period must span 1 to 3 months.`
      );
      return;
    }

    const win =
      mode === 'past' ? activeThread.narrativeWindow : activeThread.futureWindow;
    const fromLabel = formatYearMonthToLongLabel(win.startMonth);
    const toLabel = formatYearMonthToLongLabel(win.endMonth);

    // If Base API URL is configured, call GET /api/transit/dump?personId=...&from=...&to=...
    if (apiConfig.baseApiUrl.trim()) {
      const personId = (activeProfile.personId || '').trim().toUpperCase();
      if (!isValidPersonId(personId)) {
        setTimelineError('Profile ID (personId) must be 5 to 7 alphanumeric characters.');
        return;
      }

      const cleanBase = apiConfig.baseApiUrl.trim().replace(/\/+$/, '');
      const cleanPath = (apiConfig.transitEndpointPath || '/api/transit/dump').trim();
      const endpointUrl = `${cleanBase}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;

      if (mode === 'past') setSettingPast(true);
      else setSettingFuture(true);

      try {
        const res = await fetch('/api/external/fetch-dump', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: endpointUrl,
            method: 'GET',
            bearerToken: apiConfig.apiBearerToken,
            queryParams: {
              personId,
              from: fromLabel,
              to: toLabel,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to fetch ${mode} transit dump.`);
        }
        if (typeof data.text === 'string') {
          if (mode === 'past') updateNarrativeWindow({ transitDump: data.text });
          else updateFutureWindow({ transitDump: data.text });
        }
      } catch (err: unknown) {
        setTimelineError(
          err instanceof Error ? err.message : 'Unable to fetch transit details.'
        );
        if (mode === 'past') setSettingPast(false);
        else setSettingFuture(false);
        return;
      } finally {
        if (mode === 'past') setSettingPast(false);
        else setSettingFuture(false);
      }
    } else {
      // Update window label cleanly when no external API URL is set
      const labelDump = buildSampleTransitDump(
        win.startMonth,
        win.endMonth,
        parsedNatal?.moonSign || 'Moon Sign',
        mode === 'future'
      );
      if (mode === 'past') updateNarrativeWindow({ transitDump: labelDump });
      else updateFutureWindow({ transitDump: labelDump });
    }

    if (mode === 'past') setPastSet(true);
    else setFutureSet(true);
  };

  // Submit Cards -> Animate Cards while waiting for LLM (Gemini or Fable) -> Reveal Stacked Cards
  const handleSubmitThread = async () => {
    if (!activeProfile || !isNarrativeValid || !isFutureValid || activeThread.cards.length === 0) {
      return;
    }
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
          llmConfig: {
            llmProvider: apiConfig.llmProvider,
            geminiModel: apiConfig.geminiModel,
            fableEndpointUrl: apiConfig.fableEndpointUrl,
            fableModel: apiConfig.fableModel,
            fableApiKey: apiConfig.fableApiKey,
            ollamaBaseUrl: apiConfig.ollamaBaseUrl,
            ollamaModel: apiConfig.ollamaModel,
          },
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

      const autoTitle = `${formatMonthRangeLabel(
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
        profileId: activeProfile.id,
        title: autoTitle,
        submittedAt: new Date().toISOString(),
        step: 'reading',
        primaryProvider: apiConfig.llmProvider,
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

  // Post the exact same 3-fold prompt to Private LLM (Ollama) and store on a second tab
  const handlePostToPrivateLlm = async () => {
    if (!activeProfile || activeThread.cards.length === 0 || isPostingToPrivateLlm) {
      return;
    }
    setIsPostingToPrivateLlm(true);
    setPrivateLlmError(null);

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
          llmConfig: {
            llmProvider: 'ollama',
            ollamaBaseUrl: apiConfig.ollamaBaseUrl,
            ollamaModel: apiConfig.ollamaModel,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from Private LLM (Ollama).');
      }

      const readingsMap = new Map<string, CardReading>();
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

      const updatedCards: MagicCard[] = activeThread.cards.map((c, idx) => ({
        ...c,
        privateReading:
          readingsMap.get(c.id) ||
          (idx === 0 && Array.isArray(data.cardReadings) && data.cardReadings[0]
            ? {
                verdictSummary: data.cardReadings[0].verdictSummary,
                planetaryTriggers: data.cardReadings[0].planetaryTriggers,
                timingWindow: data.cardReadings[0].timingWindow,
                guidance: data.cardReadings[0].guidance,
              }
            : c.privateReading),
      }));

      const updatedThread: AstroThread = {
        ...activeThread,
        cards: updatedCards,
        privateOverallSynthesis: data.overallSynthesis || '',
        privateModel: apiConfig.ollamaModel || 'ollama',
      };

      setActiveThread(updatedThread);
      const nextSaved = savedThreads.map((t) => (t.id === updatedThread.id ? updatedThread : t));
      if (!savedThreads.some((t) => t.id === updatedThread.id)) {
        nextSaved.unshift(updatedThread);
      }
      persistThreads(nextSaved);
    } catch (err: unknown) {
      setPrivateLlmError(
        err instanceof Error ? err.message : 'Unable to reach Private LLM (Ollama).'
      );
    } finally {
      setIsPostingToPrivateLlm(false);
    }
  };

  // Change ONLY the Future Target timeline (Past Narrative remains locked) for follow-up questions
  const handleUpdateFollowUpFutureWindow = async (
    startMonth: string,
    endMonth: string
  ): Promise<boolean> => {
    if (!activeProfile) return false;
    setFollowUpWindowError(null);

    const span = monthDiffInclusive(startMonth, endMonth);
    if (span < 1 || span > 3) {
      setFollowUpWindowError('Future Target timeline must span 1 to 3 months.');
      return false;
    }

    let nextTransitDump = buildSampleTransitDump(
      startMonth,
      endMonth,
      parsedNatal?.moonSign || 'Moon Sign',
      true
    );

    if (apiConfig.baseApiUrl.trim()) {
      const personId = (activeProfile.personId || '').trim().toUpperCase();
      if (!isValidPersonId(personId)) {
        setFollowUpWindowError('Profile ID (personId) must be 5 to 7 alphanumeric characters.');
        return false;
      }

      const cleanBase = apiConfig.baseApiUrl.trim().replace(/\/+$/, '');
      const cleanPath = (apiConfig.transitEndpointPath || '/api/transit/dump').trim();
      const endpointUrl = `${cleanBase}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;

      setIsUpdatingFollowUpWindow(true);
      try {
        const res = await fetch('/api/external/fetch-dump', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: endpointUrl,
            method: 'GET',
            bearerToken: apiConfig.apiBearerToken,
            queryParams: {
              personId,
              from: formatYearMonthToLongLabel(startMonth),
              to: formatYearMonthToLongLabel(endMonth),
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch future transit dump.');
        }
        if (typeof data.text === 'string') {
          nextTransitDump = data.text;
        }
      } catch (err: unknown) {
        setFollowUpWindowError(
          err instanceof Error ? err.message : 'Unable to fetch transit details for new timeline.'
        );
        setIsUpdatingFollowUpWindow(false);
        return false;
      } finally {
        setIsUpdatingFollowUpWindow(false);
      }
    }

    const updatedThread: AstroThread = {
      ...activeThread,
      futureWindow: {
        startMonth,
        endMonth,
        transitDump: nextTransitDump,
      },
    };

    setActiveThread(updatedThread);
    const nextSaved = savedThreads.map((t) => (t.id === updatedThread.id ? updatedThread : t));
    if (!savedThreads.some((t) => t.id === updatedThread.id)) {
      nextSaved.unshift(updatedThread);
    }
    persistThreads(nextSaved);
    return true;
  };

  // Delete the Private LLM response from this thread (keeping the Gemini/primary reading intact)
  const handleDeletePrivateReading = () => {
    const cleanedCards: MagicCard[] = activeThread.cards.map((c) => {
      const { privateReading: _removed, ...rest } = c;
      return rest;
    });

    const updatedThread: AstroThread = {
      ...activeThread,
      cards: cleanedCards,
      privateOverallSynthesis: undefined,
      privateModel: undefined,
    };

    setPrivateLlmError(null);
    setActiveThread(updatedThread);
    const nextSaved = savedThreads.map((t) => (t.id === updatedThread.id ? updatedThread : t));
    persistThreads(nextSaved);
  };

  // Persistent 3-Fold Thread Follow-Up Chat (supports both fresh send and retry with full prompt)
  const executeFollowUpChat = async (
    userMessage: string,
    effectiveProvider: LlmProvider,
    historyForPrompt: ThreadMessage[],
    displayMessages: ThreadMessage[],
    userMsgId: string
  ) => {
    if (!activeProfile) return;
    setChatError(null);
    setFailedChatRequest(null);
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
          history: historyForPrompt,
          userMessage,
          llmConfig: {
            llmProvider: effectiveProvider,
            geminiModel: apiConfig.geminiModel,
            fableEndpointUrl: apiConfig.fableEndpointUrl,
            fableModel: apiConfig.fableModel,
            fableApiKey: apiConfig.fableApiKey,
            ollamaBaseUrl: apiConfig.ollamaBaseUrl,
            ollamaModel: apiConfig.ollamaModel,
          },
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
        provider: effectiveProvider,
        timestamp: new Date().toISOString(),
      };

      const finalThread: AstroThread = {
        ...activeThread,
        messages: [...displayMessages, aiMsg],
      };

      setActiveThread(finalThread);
      const nextSaved = savedThreads.map((t) => (t.id === finalThread.id ? finalThread : t));
      if (!savedThreads.some((t) => t.id === finalThread.id)) {
        nextSaved.unshift(finalThread);
      }
      persistThreads(nextSaved);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Unable to send follow-up message.');
      setFailedChatRequest({
        userMessage,
        targetProvider: effectiveProvider,
        userMsgId,
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSendChat = async (userMessage: string, targetProvider?: LlmProvider) => {
    if (!activeProfile) return;
    const effectiveProvider: LlmProvider =
      targetProvider || activeThread.primaryProvider || apiConfig.llmProvider;

    const userMsg: ThreadMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userMessage,
      provider: effectiveProvider,
      timestamp: new Date().toISOString(),
    };

    const baseHistory = failedChatRequest
      ? activeThread.messages.filter((m) => m.id !== failedChatRequest.userMsgId)
      : activeThread.messages;
    const displayMessages = [...baseHistory, userMsg];

    setActiveThread((prev) => ({
      ...prev,
      messages: displayMessages,
    }));

    await executeFollowUpChat(
      userMessage,
      effectiveProvider,
      baseHistory,
      displayMessages,
      userMsg.id
    );
  };

  const handleRetryChat = async () => {
    if (!activeProfile || isSendingChat) return;

    if (failedChatRequest) {
      const historyBeforeFailed = activeThread.messages.filter(
        (m) => m.id !== failedChatRequest.userMsgId
      );
      await executeFollowUpChat(
        failedChatRequest.userMessage,
        failedChatRequest.targetProvider,
        historyBeforeFailed,
        activeThread.messages,
        failedChatRequest.userMsgId
      );
      return;
    }

    // Fallback: if retrying last user message in thread
    const lastUserIdx = [...activeThread.messages]
      .reverse()
      .findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = activeThread.messages.length - 1 - lastUserIdx;
    const lastUserMsg = activeThread.messages[actualIdx];
    const historyBefore = activeThread.messages.slice(0, actualIdx);
    const displayMessages = activeThread.messages.slice(0, actualIdx + 1);
    const effectiveProvider: LlmProvider =
      lastUserMsg.provider || activeThread.primaryProvider || apiConfig.llmProvider;

    setActiveThread((prev) => ({
      ...prev,
      messages: displayMessages,
    }));

    await executeFollowUpChat(
      lastUserMsg.content,
      effectiveProvider,
      historyBefore,
      displayMessages,
      lastUserMsg.id
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111318] text-[#EDEFF5] flex">
      {/* LEFT SIDEBAR — PROFILE SESSION + SUBMITTED THREADS (RESIZABLE) */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="shrink-0 bg-[#161920] border-r border-[#262A34] flex flex-col justify-between relative"
      >
        <div className="p-3.5 space-y-3 border-b border-[#262A34]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-[#EDEFF5]">
                Astro AI Studio
              </span>
              <button
                type="button"
                onClick={() => setModalMode(activeProfile ? 'edit' : 'create')}
                title="Settings (Profile, REST APIs & Gemini/Fable LLM Adapters)"
                aria-label="Settings"
                className="p-1.5 rounded-lg border border-[#2E3442] bg-[#111318] text-[#D4A853] hover:border-[#D4A853]/70 hover:bg-[#1B1F29] transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Session Profile Switcher */}
          <div className="relative">
            {activeProfile ? (
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="w-full text-left bg-[#111318] hover:bg-[#14171E] border border-[#262A34] rounded-lg px-3 py-2.5 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#EDEFF5] truncate">
                      {activeProfile.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#D4A853]">
                      {activeProfile.personId}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8E95A5] truncate mt-0.5">
                    {parsedNatal?.moonSign.split('(')[0].trim()} · Natal Loaded
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModalMode('create')}
                className="w-full text-left bg-[#111318] hover:bg-[#14171E] border border-dashed border-[#363C4A] rounded-lg px-3 py-2.5 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#D4A853]">
                    Add Profile (personId)
                  </div>
                  <div className="text-[11px] text-[#8E95A5] mt-0.5">
                    No profiles loaded
                  </div>
                </div>
                <UserPlus className="w-4 h-4 text-[#D4A853] shrink-0" />
              </button>
            )}

            {profileMenuOpen && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 bg-[#1B1F28] border border-[#2D3240] rounded-lg overflow-hidden shadow-xl">
                <div className="py-1 max-h-56 overflow-y-auto">
                  {profiles.map((p) => {
                    const pParsed = parseNatalDump(p.natalDump, p.name);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-2.5 py-2 text-xs transition-colors ${
                          p.id === activeProfile?.id
                            ? 'bg-[#D4A853]/10 text-[#D4A853]'
                            : 'text-[#EDEFF5] hover:bg-[#242936]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectProfile(p)}
                          className="flex-1 min-w-0 text-left flex items-center justify-between gap-2 pr-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {p.name}{' '}
                              <span className="font-mono text-[10px] opacity-80">
                                ({p.personId})
                              </span>
                            </div>
                            <div className="text-[10px] text-[#8E95A5] truncate">
                              {pParsed.moonSign.split('(')[0].trim()} · {p.roleLabel}
                            </div>
                          </div>
                          {p.id === activeProfile?.id && (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(p.id);
                          }}
                          title={`Delete ${p.personId}`}
                          className="p-1 text-[#6C7384] hover:text-red-400 rounded transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-[#262A34] p-1.5 flex flex-col gap-1">
                  {activeProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setModalMode('edit');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-[#B9C0D0] hover:text-[#EDEFF5] hover:bg-[#242936] rounded transition-colors"
                    >
                      Settings (Natal, REST &amp; LLM)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setModalMode('create');
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#D4A853] hover:bg-[#242936] rounded transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Profile (personId)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inline Profile ID (personId) Box + Delete Button */}
          {activeProfile && (
            <div className="bg-[#111318] border border-[#262A34] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="sidebar-person-id"
                className="text-[11px] font-mono text-[#8E95A5] whitespace-nowrap"
              >
                personId
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="sidebar-person-id"
                  type="text"
                  maxLength={7}
                  value={activeProfile.personId}
                  onChange={(e) => {
                    const nextId = e.target.value.toUpperCase();
                    const updatedProfiles = profiles.map((p) =>
                      p.id === activeProfile.id ? { ...p, personId: nextId } : p
                    );
                    persistProfiles(updatedProfiles);
                  }}
                  placeholder="001ME"
                  className={`w-20 text-right bg-transparent text-xs font-mono tracking-wider outline-none ${
                    isValidPersonId(activeProfile.personId)
                      ? 'text-[#D4A853]'
                      : 'text-red-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(activeProfile.id)}
                  title={`Delete ${activeProfile.personId}`}
                  className="text-[#6C7384] hover:text-red-400 p-0.5 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!activeProfile}
            onClick={handleStartNewThread}
            className="w-full py-2 px-3 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 disabled:cursor-not-allowed text-[#111318] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Thread
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
                {activeProfile
                  ? 'Set your past & future periods, submit 1 Magic Card, and each reading lands here.'
                  : 'Create a profile first to start logging threads.'}
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
                      className="opacity-40 group-hover:opacity-100 text-[#6C7384] hover:text-red-400 transition-opacity shrink-0"
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
                    <span className="text-[#D4A853]/80">
                      {t.cards.length} {t.cards.length === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Active LLM Adapter & Natal Load */}
        <div className="px-4 py-2.5 border-t border-[#262A34] text-[11px] text-[#6C7384] flex items-center justify-between gap-2">
          <span className="font-mono uppercase text-[#D4A853] truncate">
            {apiConfig.llmProvider === 'ollama'
              ? `Private · ${apiConfig.ollamaModel || 'Ollama'}`
              : apiConfig.llmProvider === 'fable'
              ? 'Fable LLM'
              : 'Gemini LLM'}
          </span>
          <span className="font-mono tabular-nums text-[#8E95A5] shrink-0">
            {parsedNatal ? `${parsedNatal.tokenEstimate.toLocaleString()} tok` : '—'}
          </span>
        </div>

        {/* Sidebar Resize Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsResizingSidebar(true);
          }}
          className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-20 transition-colors ${
            isResizingSidebar ? 'bg-[#D4A853]' : 'hover:bg-[#D4A853]/50'
          }`}
        />
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col bg-[#111318]">
        {/* Minimal Clean Top Bar */}
        <header className="h-12 shrink-0 border-b border-[#262A34] px-6 flex items-center justify-between gap-3 bg-[#14171D]">
          <span className="text-xs font-medium text-[#EDEFF5] truncate">
            {activeProfile
              ? activeThread.step === 'reading'
                ? activeThread.title
                : `${activeProfile.name} (${activeProfile.personId})`
              : 'Profile Setup Required'}
          </span>
          {activeProfile && activeThread.step === 'reading' && (
            <button
              type="button"
              onClick={(e) => handleDeleteThread(e, activeThread.id)}
              title="Delete thread"
              className="px-2.5 py-1 rounded-md border border-[#262A34] bg-[#181B22] hover:border-red-900/60 hover:bg-red-950/30 text-[11px] text-[#8E95A5] hover:text-red-300 inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Thread</span>
            </button>
          )}
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {!activeProfile ? (
              <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-8 text-center space-y-4 mt-8">
                <h1 className="text-lg font-semibold text-[#EDEFF5]">
                  Set Up Your Profile (personId) &amp; Natal Dump
                </h1>
                <p className="text-sm text-[#8E95A5] max-w-lg mx-auto leading-relaxed">
                  Enter your 5–7 character <span className="font-mono text-[#D4A853]">personId</span> (e.g., <span className="font-mono text-[#EDEFF5]">001ME</span>), configure your REST APIs and LLM Adapter (Gemini or Fable), and load your Natal Dump once for the session.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setModalMode('create')}
                    className="px-5 py-2.5 bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create Profile &amp; Configure Settings
                  </button>
                </div>
              </div>
            ) : isAnalyzing ? (
              /* SHUFFLING CARDS ANIMATION WHILE WAITING FOR LLM RESPONSE */
              <div className="py-16 flex flex-col items-center justify-center space-y-8">
                <div className="relative h-56 w-80 flex items-center justify-center">
                  {activeThread.cards.map((card, idx) => {
                    const total = activeThread.cards.length;
                    const offset = idx - (total - 1) / 2;
                    const cTheme = getCardTheme(card.domain);
                    const CardIcon = cTheme.icon;
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ x: offset * 28, rotate: offset * 6, scale: 0.96 }}
                        animate={{
                          x: [offset * 34, -offset * 46, offset * 26],
                          y: [0, -14, 0],
                          rotate: [offset * 7, -offset * 9, offset * 5],
                          scale: [0.97, 1.03, 0.97],
                        }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: idx * 0.18,
                        }}
                        className={`absolute w-56 h-36 overflow-hidden rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_45px_rgba(0,0,0,0.45)] flex flex-col justify-between ${cTheme.surfaceGradient} ${cTheme.activeBorderClass}`}
                        style={{ backgroundImage: cTheme.ambientGlow }}
                      >
                        <div className="relative z-10 flex items-center justify-between text-[11px]">
                          <span className={`inline-flex items-center gap-1.5 font-medium ${cTheme.accentText}`}>
                            <CardIcon className="w-3.5 h-3.5" />
                            <span>{cTheme.label}</span>
                          </span>
                          <span className="font-mono text-[10px] text-white/50">
                            {card.eventDate}
                          </span>
                        </div>
                        <div className="relative z-10 text-xs font-semibold text-[#EDEFF5] line-clamp-2">
                          {card.title}
                        </div>
                        <div className="relative z-10 text-[10px] text-white/65 line-clamp-1">
                          {card.question}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="text-center space-y-1.5 max-w-lg mx-auto">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#EDEFF5]">
                    <Sparkles className="w-4 h-4 text-[#D4A853] animate-pulse" />
                    <span>
                      Exploring Realistic Possibilities (
                      {formatMonthRangeLabel(
                        activeThread.futureWindow.startMonth,
                        activeThread.futureWindow.endMonth
                      )}
                      )...
                    </span>
                  </div>
                  <p className="text-xs text-[#8E95A5] leading-relaxed">
                    Evaluating realistic scenarios and activities that can manifest from{' '}
                    {formatYearMonthToLongLabel(activeThread.futureWindow.startMonth)} to{' '}
                    {formatYearMonthToLongLabel(activeThread.futureWindow.endMonth)} based on your{' '}
                    {formatMonthRangeLabel(
                      activeThread.narrativeWindow.startMonth,
                      activeThread.narrativeWindow.endMonth
                    )}{' '}
                    events.
                  </p>
                </div>
              </div>
            ) : activeThread.step === 'narrative' ? (
              <div className="space-y-6">
                {/* STAGE 1: SET PAST NARRATIVE PERIOD (FROM & TO DROPDOWNS + SET) */}
                {!pastSet ? (
                  <div className="max-w-xl mx-auto mt-6 bg-[#181B22] border border-[#262A34] rounded-xl p-6 space-y-5">
                    <div>
                      <div className="text-[11px] font-mono text-[#D4A853] mb-1">
                        STEP 1 OF 3
                      </div>
                      <h1 className="text-lg font-semibold text-[#EDEFF5]">
                        Set Past Narrative Period
                      </h1>
                      <p className="text-xs text-[#8E95A5] mt-1">
                        Select From and To (1–3 months max) and click Set to load this window.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                          From
                        </label>
                        <select
                          value={activeThread.narrativeWindow.startMonth}
                          onChange={(e) =>
                            updateNarrativeWindow({ startMonth: e.target.value })
                          }
                          className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2.5 text-sm text-[#EDEFF5] outline-none"
                        >
                          {MONTH_YEAR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                          To
                        </label>
                        <select
                          value={activeThread.narrativeWindow.endMonth}
                          onChange={(e) =>
                            updateNarrativeWindow({ endMonth: e.target.value })
                          }
                          className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2.5 text-sm text-[#EDEFF5] outline-none"
                        >
                          {MONTH_YEAR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {timelineError && (
                      <p className="text-xs text-red-400">{timelineError}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#262A34]">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isNarrativeValid ? 'text-[#8E95A5]' : 'text-red-400'
                        }`}
                      >
                        {narrativeMonthsCount >= 1
                          ? `${narrativeMonthsCount} / 3 months`
                          : 'End must be >= Start'}
                      </span>
                      <button
                        type="button"
                        disabled={!isNarrativeValid || settingPast}
                        onClick={() => handleSetPeriod('past')}
                        className="px-5 py-2 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold rounded-lg transition-colors"
                      >
                        {settingPast ? 'Setting...' : 'Set'}
                      </button>
                    </div>
                  </div>
                ) : !futureSet ? (
                  /* STAGE 2: SET FUTURE TARGET PERIOD (FROM & TO DROPDOWNS + SET) */
                  <div className="max-w-xl mx-auto mt-6 space-y-4">
                    <div className="bg-[#161920] border border-[#262A34] rounded-lg px-4 py-2.5 flex items-center justify-between text-xs">
                      <span className="text-[#B9C0D0]">
                        Past Narrative:{' '}
                        <span className="text-[#D4A853] font-medium">
                          {formatMonthRangeLabel(
                            activeThread.narrativeWindow.startMonth,
                            activeThread.narrativeWindow.endMonth
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPastSet(false)}
                        className="text-[#8E95A5] hover:text-[#EDEFF5] text-[11px]"
                      >
                        Change
                      </button>
                    </div>

                    <div className="bg-[#181B22] border border-[#262A34] rounded-xl p-6 space-y-5">
                      <div>
                        <div className="text-[11px] font-mono text-[#D4A853] mb-1">
                          STEP 2 OF 3
                        </div>
                        <h1 className="text-lg font-semibold text-[#EDEFF5]">
                          Set Future Target Period
                        </h1>
                        <p className="text-xs text-[#8E95A5] mt-1">
                          Select From and To (1–3 months max) and click Set to deal your Magic Card.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                            From
                          </label>
                          <select
                            value={activeThread.futureWindow.startMonth}
                            onChange={(e) =>
                              updateFutureWindow({ startMonth: e.target.value })
                            }
                            className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2.5 text-sm text-[#EDEFF5] outline-none"
                          >
                            {MONTH_YEAR_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                            To
                          </label>
                          <select
                            value={activeThread.futureWindow.endMonth}
                            onChange={(e) =>
                              updateFutureWindow({ endMonth: e.target.value })
                            }
                            className="w-full bg-[#111318] border border-[#262A34] focus:border-[#D4A853] rounded-lg px-3 py-2.5 text-sm text-[#EDEFF5] outline-none"
                          >
                            {MONTH_YEAR_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {timelineError && (
                        <p className="text-xs text-red-400">{timelineError}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-[#262A34]">
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isFutureValid ? 'text-[#8E95A5]' : 'text-red-400'
                          }`}
                        >
                          {futureMonthsCount >= 1
                            ? `${futureMonthsCount} / 3 months`
                            : 'End must be >= Start'}
                        </span>
                        <button
                          type="button"
                          disabled={!isFutureValid || settingFuture}
                          onClick={() => handleSetPeriod('future')}
                          className="px-5 py-2 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold rounded-lg transition-colors"
                        >
                          {settingFuture ? 'Setting...' : 'Set'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STAGE 3: MAGIC CARD (1 PER THREAD) + SUBMIT CARD */
                  <div className="space-y-5">
                    <div className="bg-[#161920] border border-[#262A34] rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-[#B9C0D0]">
                        <span>
                          Past:{' '}
                          <span className="text-[#D4A853] font-medium">
                            {formatMonthRangeLabel(
                              activeThread.narrativeWindow.startMonth,
                              activeThread.narrativeWindow.endMonth
                            )}
                          </span>
                        </span>
                        <span className="text-[#555C6E]">→</span>
                        <span>
                          Future:{' '}
                          <span className="text-[#EDEFF5] font-medium">
                            {formatMonthRangeLabel(
                              activeThread.futureWindow.startMonth,
                              activeThread.futureWindow.endMonth
                            )}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFutureSet(false)}
                        className="text-[11px] text-[#8E95A5] hover:text-[#EDEFF5]"
                      >
                        Change Future Period
                      </button>
                    </div>

                    {analyzeError && (
                      <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3 text-xs text-red-300">
                        {analyzeError}
                      </div>
                    )}

                    <MagicCardDeck
                      startMonth={activeThread.narrativeWindow.startMonth}
                      endMonth={activeThread.narrativeWindow.endMonth}
                      isRangeValid={isNarrativeValid}
                      isFutureValid={isFutureValid}
                      isSubmitting={isAnalyzing}
                      cards={activeThread.cards}
                      onChangeCards={(cards) =>
                        setActiveThread((prev) => ({ ...prev, cards }))
                      }
                      onSubmitThread={handleSubmitThread}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* COMPLETED READING: CARD SPREAD + DUAL-TAB PRIVATE LLM + FOLLOW-UP CHAT */
              <OpenedCardSpread
                thread={activeThread}
                isSendingChat={isSendingChat}
                chatError={chatError}
                onSendChat={handleSendChat}
                onRetryChat={handleRetryChat}
                canRetryChat={
                  Boolean(failedChatRequest) ||
                  activeThread.messages.some((m) => m.role === 'user')
                }
                isPostingToPrivateLlm={isPostingToPrivateLlm}
                privateLlmError={privateLlmError}
                onPostToPrivateLlm={handlePostToPrivateLlm}
                onDeletePrivateReading={handleDeletePrivateReading}
                isUpdatingFutureWindow={isUpdatingFollowUpWindow}
                futureWindowError={followUpWindowError}
                onUpdateFutureWindow={handleUpdateFollowUpFutureWindow}
              />
            )}
          </div>
        </div>

        {/* BOTTOM COMPLETE-PROMPT BAR (CONSULTING STATE + READING INSPECTOR) */}
        {activeProfile &&
          fullConsultingPrompt &&
          (isAnalyzing || activeThread.step === 'reading') && (
            <div className="shrink-0 border-t border-[#262A34] bg-[#14171D]">
              {showFullPromptPreview && (
                <div className="border-b border-[#262A34] bg-[#0E1015] px-6 py-3">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4A853]">
                        Complete 3-Fold Prompt Dump (System + Natal + Past + Cards + Future)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#6C7384]">
                        {fullConsultingPrompt.fullCombinedPrompt.length.toLocaleString()} chars · ~
                        {Math.ceil(fullConsultingPrompt.fullCombinedPrompt.length / 4).toLocaleString()} tok
                      </span>
                    </div>
                    <pre className="max-h-72 overflow-y-auto rounded-lg border border-[#262A34] bg-[#111318] p-3 text-[11px] leading-relaxed font-mono text-[#C8CDD8] whitespace-pre-wrap break-words select-all">
                      {fullConsultingPrompt.fullCombinedPrompt}
                    </pre>
                  </div>
                </div>
              )}

              <div className="px-6 py-2.5">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-mono uppercase tracking-wider text-[#D4A853]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isAnalyzing ? 'bg-[#D4A853] animate-pulse' : 'bg-emerald-400'
                        }`}
                      />
                      {isAnalyzing ? 'Consulting Prompt' : 'Complete Prompt'}
                    </span>
                    <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-[#6C7384] shrink-0">
                      {fullConsultingPrompt.fullCombinedPrompt.length.toLocaleString()} chars
                    </span>
                    <span className="text-xs font-mono text-[#8E95A5] truncate">
                      {fullConsultingPrompt.userPrompt.replace(/\s+/g, ' ').slice(0, 140)}…
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowFullPromptPreview((v) => !v)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#262A34] bg-[#181B22] hover:bg-[#1E222B] text-[11px] font-medium text-[#B9C0D0] inline-flex items-center gap-1.5 transition-colors"
                      title={showFullPromptPreview ? 'Hide complete prompt' : 'View complete prompt'}
                    >
                      {showFullPromptPreview ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Hide Prompt</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>View Prompt</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyFullPrompt}
                      title="Copy entire constructed prompt dump to clipboard"
                      aria-label="Copy entire constructed prompt dump to clipboard"
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        copiedPrompt
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                          : 'border-[#D4A853]/40 bg-[#D4A853]/10 hover:bg-[#D4A853]/20 text-[#D4A853]'
                      }`}
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>

      {modalMode && (
        <NatalConfigModal
          isOpen={Boolean(modalMode)}
          mode={modalMode}
          profile={activeProfile || undefined}
          apiConfig={apiConfig}
          onClose={() => setModalMode(null)}
          onSave={handleSaveProfileModal}
          onSaveConfigOnly={persistConfig}
          onDelete={handleDeleteProfile}
        />
      )}
    </div>
  );
}
