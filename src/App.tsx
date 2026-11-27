import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AstroProfile,
  AstroThread,
  CardReading,
  GrahaTimelineData,
  ImportedSourceSystem,
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
import { MagicCardDeck, ImportPromptCopyResult } from './components/MagicCardDeck';
import { OpenedCardSpread } from './components/OpenedCardSpread';
import { NatalConfigModal } from './components/NatalConfigModal';
import { RightImportPanel } from './components/RightImportPanel';
import { buildAnalyzePromptParts } from './data/promptBuilder';
import { buildCondensedImportPrompt } from './data/importPromptBuilder';
import { getCardTheme } from './data/cardThemes';
import { ProviderIcon } from './components/ProviderIcon';
import { parseImportedReport } from './data/importedReportParser';

const STORAGE_PROFILES_KEY = 'astro_studio_profiles_v2';
const STORAGE_THREADS_KEY = 'astro_studio_threads_v2';
const STORAGE_CONFIG_KEY = 'astro_studio_config_v2';
const STORAGE_ACTIVE_PROFILE_KEY = 'astro_studio_active_profile_v1';
const STORAGE_ACTIVE_THREAD_KEY = 'astro_studio_active_thread_v1';
const STORAGE_DRAFT_STATE_KEY = 'astro_studio_draft_state_v1';
const STORAGE_THEME_KEY = 'astro_studio_theme_v1';

type AppTheme = 'primary' | 'daylight';

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
    personId: profile?.personId || undefined,
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

function deriveThreadSubjectTitle(
  thread: Pick<
    AstroThread,
    'title' | 'isCustomTitle' | 'isImported' | 'cards' | 'narrativeWindow' | 'futureWindow'
  >
): string {
  const existing = typeof thread.title === 'string' ? thread.title.trim() : '';
  if ((thread.isCustomTitle || thread.isImported) && existing) {
    return existing;
  }
  const cardSubjects = (thread.cards || [])
    .map((c) => (typeof c.title === 'string' ? c.title.trim() : ''))
    .filter(Boolean);
  if (cardSubjects.length > 0) {
    return cardSubjects.join(' · ');
  }
  if (existing && existing !== 'New Thread') {
    return existing;
  }
  return 'New Thread';
}

function resolveThreadProvider(thread: AstroThread): LlmProvider | null {
  if (thread.primaryProvider) return thread.primaryProvider;
  if (thread.isImported) {
    if (thread.importedSource === 'claude') return 'fable';
    if (thread.importedSource === 'gemini') return 'gemini';
    return null;
  }
  const modelStr = (thread.primaryModel || '').toLowerCase();
  if (/claude|fable|anthropic|palm/.test(modelStr)) return 'fable';
  if (/gemini/.test(modelStr)) return 'gemini';
  if (/ollama|qwen|llama|mistral|deepseek/.test(modelStr)) return 'ollama';
  for (const card of thread.cards || []) {
    if (card.reading?.grahaTimeline?.generatedByProvider) {
      return card.reading.grahaTimeline.generatedByProvider;
    }
  }
  const msgProvider = (thread.messages || []).find((m) => m.provider)?.provider;
  if (msgProvider) return msgProvider;
  if (
    thread.step === 'reading' ||
    Boolean(thread.overallSynthesis) ||
    Boolean(thread.cards?.some((c) => Boolean(c.reading)))
  ) {
    return 'gemini';
  }
  return null;
}

function normalizeThread(thread: AstroThread): AstroThread {
  const currentTitle = typeof thread.title === 'string' ? thread.title.trim() : '';
  const hasCardSubject = Boolean(thread.cards?.some((c) => typeof c.title === 'string' && c.title.trim()));
  const looksAutoOrBlank =
    !currentTitle || currentTitle === 'New Thread' || currentTitle.includes(' → ');
  const resolvedTitle =
    (thread.isCustomTitle || thread.isImported) && currentTitle
      ? currentTitle
      : hasCardSubject && looksAutoOrBlank
      ? deriveThreadSubjectTitle(thread)
      : currentTitle || deriveThreadSubjectTitle(thread);
  const hasReading = Boolean(
    thread.isImported ||
      thread.overallSynthesis ||
      thread.privateOverallSynthesis ||
      thread.cards?.some((c) => Boolean(c.reading || c.privateReading)) ||
      (thread.messages && thread.messages.length > 0)
  );
  return {
    ...thread,
    title: resolvedTitle,
    step: thread.step === 'reading' || hasReading ? 'reading' : 'narrative',
    cards: Array.isArray(thread.cards) ? thread.cards : [],
    messages: Array.isArray(thread.messages) ? thread.messages : [],
  };
}

function scoreThreadCompleteness(t: AstroThread): number {
  let score = 0;
  if (t.step === 'reading') score += 20;
  if (t.overallSynthesis) score += 10;
  if (t.privateOverallSynthesis) score += 10;
  for (const c of t.cards || []) {
    score += 5;
    if (c.reading) score += 25;
    if (c.reading?.grahaTimeline?.factors?.length) score += 20;
    if (c.privateReading) score += 25;
    if (c.privateReading?.grahaTimeline?.factors?.length) score += 20;
  }
  score += (t.messages?.length || 0) * 6;
  return score;
}

function getThreadTimestampMs(t: AstroThread): number {
  const iso = t.updatedAt || t.submittedAt || t.createdAt;
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? ms : 0;
}

function mergeThreadCollections(
  serverThreads: AstroThread[],
  localThreads: AstroThread[]
): AstroThread[] {
  const byId = new Map<string, AstroThread>();
  for (const raw of [...serverThreads, ...localThreads]) {
    if (!raw || !raw.id || LEGACY_SEEDED_IDS.has(raw.profileId)) continue;
    const candidate = normalizeThread(raw);
    const existing = byId.get(candidate.id);
    if (!existing) {
      byId.set(candidate.id, candidate);
      continue;
    }
    const existingScore = scoreThreadCompleteness(existing);
    const candidateScore = scoreThreadCompleteness(candidate);
    if (
      candidateScore > existingScore ||
      (candidateScore === existingScore &&
        getThreadTimestampMs(candidate) >= getThreadTimestampMs(existing))
    ) {
      byId.set(candidate.id, candidate);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => getThreadTimestampMs(b) - getThreadTimestampMs(a)
  );
}

function mergeProfileCollections(
  serverProfiles: AstroProfile[],
  localProfiles: AstroProfile[]
): AstroProfile[] {
  const byId = new Map<string, AstroProfile>();
  for (const p of [...serverProfiles, ...localProfiles]) {
    if (!p || !p.id || LEGACY_SEEDED_IDS.has(p.id)) continue;
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, p);
      continue;
    }
    const existingMs = Date.parse(existing.updatedAt || '') || 0;
    const candidateMs = Date.parse(p.updatedAt || '') || 0;
    if (candidateMs >= existingMs) {
      byId.set(p.id, p);
    }
  }
  return Array.from(byId.values());
}

export default function App() {
  const [profiles, setProfiles] = useState<AstroProfile[]>(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [apiConfig, setApiConfig] = useState<StudioApiConfig>(DEFAULT_API_CONFIG);
  const [savedThreads, setSavedThreads] = useState<AstroThread[]>([]);
  const [activeThread, setActiveThread] = useState<AstroThread>(() =>
    createInitialDraftThread(null)
  );
  const savedThreadsRef = useRef<AstroThread[]>([]);
  const profilesRef = useRef<AstroProfile[]>(DEFAULT_PROFILES);
  const hasHydratedRef = useRef(false);

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
  const [buildingTimelineThreadId, setBuildingTimelineThreadId] = useState<string | null>(null);
  const [timelineBuildError, setTimelineBuildError] = useState<string | null>(null);
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
  const [copiedCondensedPrompt, setCopiedCondensedPrompt] = useState(false);
  const [showFullPromptPreview, setShowFullPromptPreview] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState('');
  const [rightImportOpen, setRightImportOpen] = useState(true);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) === 'daylight' ? 'daylight' : 'primary';
    } catch {
      return 'primary';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appTheme === 'primary');
    try {
      localStorage.setItem(STORAGE_THEME_KEY, appTheme);
    } catch {
      // ignore
    }
  }, [appTheme]);

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
      let serverProfiles: AstroProfile[] = [];
      let serverThreads: AstroThread[] = [];
      let localProfiles: AstroProfile[] = [];
      let localThreads: AstroThread[] = [];
      let loadedConfig: Partial<StudioApiConfig> | null = null;

      try {
        const [pRes, tRes, cRes] = await Promise.all([
          fetch('/api/profiles'),
          fetch('/api/threads'),
          fetch('/api/config'),
        ]);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData.profiles)) serverProfiles = pData.profiles;
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          if (Array.isArray(tData.threads)) serverThreads = tData.threads;
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.config) loadedConfig = cData.config;
        }
      } catch {
        // Fallback to localStorage below
      }

      try {
        const localP = localStorage.getItem(STORAGE_PROFILES_KEY);
        if (localP) {
          const parsedP = JSON.parse(localP);
          if (Array.isArray(parsedP)) localProfiles = parsedP;
        }
      } catch {
        // ignore
      }

      try {
        const localT = localStorage.getItem(STORAGE_THREADS_KEY);
        if (localT) {
          const parsedT = JSON.parse(localT);
          if (Array.isArray(parsedT)) localThreads = parsedT;
        }
      } catch {
        // ignore
      }

      if (!loadedConfig) {
        try {
          const localC = localStorage.getItem(STORAGE_CONFIG_KEY);
          if (localC) loadedConfig = JSON.parse(localC);
        } catch {
          // ignore
        }
      }

      const cleanedProfiles = mergeProfileCollections(serverProfiles, localProfiles);
      profilesRef.current = cleanedProfiles;
      setProfiles(cleanedProfiles);

      const mergedThreads = mergeThreadCollections(serverThreads, localThreads);
      savedThreadsRef.current = mergedThreads;
      setSavedThreads(mergedThreads);

      // Keep server and localStorage synchronized with merged collections
      try {
        localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(cleanedProfiles));
        if (cleanedProfiles.length > serverProfiles.length) {
          void fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profiles: cleanedProfiles }),
          });
        }
      } catch {
        // ignore
      }

      try {
        localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(mergedThreads));
        const serverSerialized = JSON.stringify(serverThreads);
        const mergedSerialized = JSON.stringify(mergedThreads);
        if (mergedThreads.length > 0 && serverSerialized !== mergedSerialized) {
          void fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threads: mergedThreads }),
          });
        }
      } catch {
        // ignore
      }

      let rememberedProfileId = '';
      let rememberedThreadId = '';
      try {
        rememberedProfileId = localStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY) || '';
        rememberedThreadId = localStorage.getItem(STORAGE_ACTIVE_THREAD_KEY) || '';
      } catch {
        // ignore
      }

      const selectedProfile =
        cleanedProfiles.find((p) => p.id === rememberedProfileId) ||
        cleanedProfiles[0] ||
        null;
      setActiveProfileId(selectedProfile?.id || '');

      const matchedSavedThread = rememberedThreadId
        ? mergedThreads.find((t) => t.id === rememberedThreadId)
        : undefined;

      if (matchedSavedThread) {
        setActiveThread(matchedSavedThread);
        setPastSet(true);
        setFutureSet(
          matchedSavedThread.step === 'reading' ||
            matchedSavedThread.cards.length > 0 ||
            Boolean(matchedSavedThread.futureWindow?.transitDump)
        );
      } else {
        let restoredDraft = false;
        try {
          const rawDraft = localStorage.getItem(STORAGE_DRAFT_STATE_KEY);
          if (rawDraft) {
            const parsedDraft = JSON.parse(rawDraft) as {
              thread?: AstroThread;
              pastSet?: boolean;
              futureSet?: boolean;
            };
            if (
              parsedDraft?.thread &&
              (!selectedProfile ||
                !parsedDraft.thread.profileId ||
                parsedDraft.thread.profileId === selectedProfile.id)
            ) {
              setActiveThread(normalizeThread(parsedDraft.thread));
              setPastSet(Boolean(parsedDraft.pastSet));
              setFutureSet(Boolean(parsedDraft.futureSet));
              restoredDraft = true;
            }
          }
        } catch {
          // ignore
        }

        if (!restoredDraft) {
          setActiveThread(createInitialDraftThread(selectedProfile));
          setPastSet(false);
          setFutureSet(false);
        }
      }

      if (loadedConfig) {
        setApiConfig({ ...DEFAULT_API_CONFIG, ...loadedConfig });
      }
      hasHydratedRef.current = true;
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    try {
      if (activeProfileId) {
        localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, activeProfileId);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_PROFILE_KEY);
      }
    } catch {
      // ignore
    }
  }, [activeProfileId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    try {
      if (activeThread?.id) {
        localStorage.setItem(STORAGE_ACTIVE_THREAD_KEY, activeThread.id);
      }
      localStorage.setItem(
        STORAGE_DRAFT_STATE_KEY,
        JSON.stringify({
          thread: activeThread,
          pastSet,
          futureSet,
        })
      );
    } catch {
      // ignore
    }
  }, [activeThread, pastSet, futureSet]);

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

  const profileThreads = useMemo(() => {
    if (!activeProfile) return savedThreads;
    const knownProfileIds = new Set(profiles.map((p) => p.id));
    const activePidUpper = (activeProfile.personId || '').trim().toUpperCase();
    return savedThreads.filter(
      (t) =>
        t.profileId === activeProfile.id ||
        Boolean(
          activePidUpper &&
            t.personId &&
            t.personId.trim().toUpperCase() === activePidUpper
        ) ||
        !t.profileId ||
        !knownProfileIds.has(t.profileId)
    );
  }, [savedThreads, activeProfile, profiles]);

  const normalThreads = useMemo(
    () => profileThreads.filter((t) => !t.isImported),
    [profileThreads]
  );

  const importedThreads = useMemo(
    () => profileThreads.filter((t) => Boolean(t.isImported)),
    [profileThreads]
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

  const copyPlainTextToClipboard = async (textToCopy: string): Promise<boolean> => {
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

    return copied;
  };

  const handleCopyFullPrompt = async () => {
    if (!fullConsultingPrompt) return;
    const copied = await copyPlainTextToClipboard(fullConsultingPrompt.fullCombinedPrompt);
    if (copied) {
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2200);
    }
  };

  const handleCopyImportCardPrompt = async (): Promise<ImportPromptCopyResult | null> => {
    if (!activeProfile || activeThread.cards.length === 0) return null;
    const result = buildCondensedImportPrompt({
      profileName: activeProfile.name,
      natalDump: activeProfile.natalDump,
      narrativeWindow: activeThread.narrativeWindow,
      cards: activeThread.cards,
      futureWindow: activeThread.futureWindow,
    });
    await copyPlainTextToClipboard(result.condensedPrompt);
    setCopiedCondensedPrompt(true);
    window.setTimeout(() => setCopiedCondensedPrompt(false), 2400);
    return result;
  };

  const persistProfiles = async (nextProfiles: AstroProfile[]) => {
    profilesRef.current = nextProfiles;
    setProfiles(nextProfiles);
    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(nextProfiles));
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: nextProfiles }),
        keepalive: true,
      });
    } catch {
      // local state updated
    }
  };

  const persistThreads = async (
    updater: AstroThread[] | ((prev: AstroThread[]) => AstroThread[])
  ) => {
    const base = savedThreadsRef.current;
    const rawNext = typeof updater === 'function' ? updater(base) : updater;
    const nextThreads = rawNext.map(normalizeThread);
    savedThreadsRef.current = nextThreads;
    setSavedThreads(nextThreads);
    try {
      localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(nextThreads));
      await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: nextThreads }),
        keepalive: true,
      });
    } catch {
      // local state updated
    }
  };

  const upsertSavedThread = (thread: AstroThread, profileOverride?: AstroProfile | null): AstroThread => {
    const prof = profileOverride !== undefined ? profileOverride : activeProfile;
    const stamped: AstroThread = normalizeThread({
      ...thread,
      profileId: thread.profileId || prof?.id || '',
      personId: thread.personId || prof?.personId || undefined,
      title: deriveThreadSubjectTitle(thread),
      updatedAt: new Date().toISOString(),
    });
    void persistThreads((prev) => [stamped, ...prev.filter((t) => t.id !== stamped.id)]);
    return stamped;
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
    setTimelineBuildError(null);
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
    const remaining = profilesRef.current.filter((p) => p.id !== profileId);
    const remainingThreads = savedThreadsRef.current.filter((t) => t.profileId !== profileId);
    void persistProfiles(remaining);
    void persistThreads(remainingThreads);
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
    const normalized = normalizeThread(thread);
    const hasReading =
      normalized.step === 'reading' ||
      Boolean(normalized.overallSynthesis || normalized.privateOverallSynthesis) ||
      normalized.cards.some((c) => Boolean(c.reading || c.privateReading)) ||
      normalized.messages.length > 0;
    setActiveThread({
      ...normalized,
      step: hasReading ? 'reading' : 'narrative',
    });
    setPastSet(true);
    setFutureSet(
      hasReading ||
        normalized.cards.length > 0 ||
        Boolean(normalized.futureWindow?.transitDump)
    );
    setAnalyzeError(null);
    setTimelineBuildError(null);
    setPrivateLlmError(null);
    setFollowUpWindowError(null);
    setChatError(null);
    setFailedChatRequest(null);
  };

  const handleDeleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingThreadId === id) {
      setEditingThreadId(null);
      setEditingThreadTitle('');
    }
    void persistThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThread.id === id) {
      resetThreadFlow(activeProfile);
    }
  };

  const handleImportReport = (params: {
    rawContent: string;
    fileName?: string;
    preferredSource: ImportedSourceSystem | 'auto';
    customTitle?: string;
  }) => {
    const parsed = parseImportedReport(params.rawContent, {
      fileName: params.fileName,
      preferredSource: params.preferredSource,
      customTitle: params.customTitle,
      profileId: activeProfile?.id || '',
      personId: activeProfile?.personId,
      defaultNarrativeWindow: activeThread.narrativeWindow,
      defaultFutureWindow: activeThread.futureWindow,
    });

    const saved = upsertSavedThread(parsed.thread, activeProfile);
    setActiveThread(saved);
    setPastSet(true);
    setFutureSet(true);
    setAnalyzeError(null);
    setTimelineBuildError(null);
    setPrivateLlmError(null);
    setFollowUpWindowError(null);
    setChatError(null);
    setFailedChatRequest(null);

    return {
      title: saved.title,
      format: parsed.detectedFormat,
      source: parsed.detectedSource,
      matchedFields: parsed.matchedFields,
    };
  };

  const handleStartRenameThread = (e: React.MouseEvent, thread: AstroThread) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditingThreadTitle(thread.title || '');
  };

  const handleCancelRenameThread = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setEditingThreadId(null);
    setEditingThreadTitle('');
  };

  const handleCommitRenameThread = (id: string) => {
    const trimmed = editingThreadTitle.trim();
    setEditingThreadId(null);
    setEditingThreadTitle('');
    if (!trimmed) return;

    const nowIso = new Date().toISOString();
    void persistThreads((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, title: trimmed, isCustomTitle: true, updatedAt: nowIso }
          : t
      )
    );
    if (activeThread.id === id) {
      setActiveThread((prev) => ({
        ...prev,
        title: trimmed,
        isCustomTitle: true,
        updatedAt: nowIso,
      }));
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

    let resolvedDump = win.transitDump;

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
          resolvedDump = data.text;
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
      resolvedDump = buildSampleTransitDump(
        win.startMonth,
        win.endMonth,
        parsedNatal?.moonSign || 'Moon Sign',
        mode === 'future'
      );
    }

    const updatedThread: AstroThread =
      mode === 'past'
        ? {
            ...activeThread,
            narrativeWindow: { ...activeThread.narrativeWindow, transitDump: resolvedDump },
            updatedAt: new Date().toISOString(),
          }
        : {
            ...activeThread,
            futureWindow: { ...activeThread.futureWindow, transitDump: resolvedDump },
            updatedAt: new Date().toISOString(),
          };
    setActiveThread(updatedThread);

    if (savedThreadsRef.current.some((t) => t.id === updatedThread.id)) {
      upsertSavedThread(updatedThread, activeProfile);
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

    const resolvedPrimaryModel =
      apiConfig.llmProvider === 'fable'
        ? apiConfig.fableModel?.trim() || 'Fable'
        : apiConfig.llmProvider === 'ollama'
        ? apiConfig.ollamaModel?.trim() || 'Ollama'
        : apiConfig.geminiModel?.trim() || 'gemini-4-hydrogen';

    const subjectTitle = deriveThreadSubjectTitle(activeThread);
    const stagedThread: AstroThread = {
      ...activeThread,
      profileId: activeProfile.id,
      personId: activeProfile.personId,
      title: subjectTitle,
      primaryProvider: apiConfig.llmProvider,
      primaryModel: resolvedPrimaryModel,
      updatedAt: new Date().toISOString(),
    };
    setActiveThread(stagedThread);
    upsertSavedThread(stagedThread, activeProfile);

    try {
      const res = await fetch('/api/astro/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: activeProfile.name,
          natalDump: activeProfile.natalDump,
          narrativeWindow: stagedThread.narrativeWindow,
          cards: stagedThread.cards,
          futureWindow: stagedThread.futureWindow,
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

      const enrichedCards: MagicCard[] = stagedThread.cards.map((c, idx) => ({
        ...c,
        reading:
          readingsMap.get(c.id) ||
          (idx === 0 && Array.isArray(data.cardReadings) && data.cardReadings[0]
            ? {
                verdictSummary: data.cardReadings[0].verdictSummary,
                planetaryTriggers: data.cardReadings[0].planetaryTriggers,
                timingWindow: data.cardReadings[0].timingWindow,
                guidance: data.cardReadings[0].guidance,
              }
            : undefined),
      }));

      const fallbackDateTitle = `${formatMonthRangeLabel(
        stagedThread.narrativeWindow.startMonth,
        stagedThread.narrativeWindow.endMonth
      )} → ${formatMonthRangeLabel(
        stagedThread.futureWindow.startMonth,
        stagedThread.futureWindow.endMonth
      )} · ${enrichedCards
        .map((c) => c.domain)
        .slice(0, 2)
        .join(' & ')}`;

      const finalSubjectTitle =
        stagedThread.isCustomTitle && stagedThread.title.trim()
          ? stagedThread.title.trim()
          : enrichedCards
              .map((c) => c.title.trim())
              .filter(Boolean)
              .join(' · ') ||
            (stagedThread.title && stagedThread.title !== 'New Thread'
              ? stagedThread.title
              : fallbackDateTitle);

      const completedThread: AstroThread = {
        ...stagedThread,
        profileId: activeProfile.id,
        personId: activeProfile.personId,
        title: finalSubjectTitle,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        step: 'reading',
        primaryProvider: apiConfig.llmProvider,
        primaryModel: resolvedPrimaryModel,
        cards: enrichedCards,
        overallSynthesis: data.overallSynthesis || '',
      };

      setActiveThread(completedThread);
      upsertSavedThread(completedThread, activeProfile);
    } catch (err: unknown) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Unable to unfold readings. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Attach GrahaTimelineData onto a specific thread/card reading (primary or private) and persist
  const attachGrahaTimelineToThread = (
    targetThreadId: string,
    targetCardId: string,
    sourceTab: 'primary' | 'private',
    grahaTimeline: GrahaTimelineData,
    fallbackThread?: AstroThread
  ) => {
    const attach = (thread: AstroThread): AstroThread => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      cards: thread.cards.map((c) => {
        if (c.id !== targetCardId) return c;
        if (sourceTab === 'private' && c.privateReading) {
          return {
            ...c,
            privateReading: {
              ...c.privateReading,
              grahaTimeline,
            },
          };
        }
        if (c.reading) {
          return {
            ...c,
            reading: {
              ...c.reading,
              grahaTimeline,
            },
          };
        }
        return c;
      }),
    });

    setActiveThread((prev) => (prev.id === targetThreadId ? attach(prev) : prev));
    void persistThreads((prevThreads) => {
      const exists = prevThreads.some((t) => t.id === targetThreadId);
      return exists
        ? prevThreads.map((t) => (t.id === targetThreadId ? attach(t) : t))
        : fallbackThread
        ? [attach(fallbackThread), ...prevThreads]
        : prevThreads;
    });
  };

  // Secondary Request 2 (Same-Engine Extraction): feed Request 1 context + reasoning to the exact
  // same engine that produced Request 1 (Gemini -> Gemini, Fable -> Fable, Ollama -> Ollama)
  const runPrivateTimelineDecision = async (
    targetThread: AstroThread,
    targetCardId?: string,
    sourceTab: 'primary' | 'private' = 'primary'
  ) => {
    const targetCard =
      targetThread.cards.find((c) => c.id === targetCardId) || targetThread.cards[0];
    const sourceReading =
      sourceTab === 'private' ? targetCard?.privateReading : targetCard?.reading;
    if (!targetCard || !sourceReading?.planetaryTriggers) {
      return;
    }

    const targetProvider: LlmProvider =
      sourceTab === 'private'
        ? 'ollama'
        : targetThread.primaryProvider || apiConfig.llmProvider;

    setBuildingTimelineThreadId(targetThread.id);
    setTimelineBuildError(null);

    try {
      const res = await fetch('/api/astro/timeline-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: targetCard.domain,
          title: targetCard.title,
          eventDate: targetCard.eventDate,
          narrative: targetCard.narrative,
          question: targetCard.question,
          pastStartMonth: targetThread.narrativeWindow.startMonth,
          pastEndMonth: targetThread.narrativeWindow.endMonth,
          futureStartMonth: targetThread.futureWindow.startMonth,
          futureEndMonth: targetThread.futureWindow.endMonth,
          natalDump: activeProfile?.natalDump || '',
          pastTransitDump: targetThread.narrativeWindow.transitDump,
          futureTransitDump: targetThread.futureWindow.transitDump,
          verdictSummary: sourceReading.verdictSummary,
          timingWindow: sourceReading.timingWindow,
          guidance: sourceReading.guidance,
          planetaryTriggers: sourceReading.planetaryTriggers,
          llmConfig: {
            llmProvider: targetProvider,
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
        throw new Error(
          data.error || 'Engine failed to convert Request 1 reasoning into animation plot data.'
        );
      }

      const grahaTimeline = data.grahaTimeline as GrahaTimelineData | undefined;
      if (!grahaTimeline || !grahaTimeline.factors?.length) {
        throw new Error('Engine returned empty animation factors.');
      }

      attachGrahaTimelineToThread(
        targetThread.id,
        targetCard.id,
        sourceTab,
        grahaTimeline,
        targetThread
      );
    } catch (err: unknown) {
      setTimelineBuildError(
        err instanceof Error
          ? err.message
          : 'Unable to extract 2D animation data from reasoning.'
      );
    } finally {
      setBuildingTimelineThreadId((prev) => (prev === targetThread.id ? null : prev));
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
        profileId: activeProfile.id,
        personId: activeProfile.personId,
        cards: updatedCards,
        privateOverallSynthesis: data.overallSynthesis || '',
        privateModel: apiConfig.ollamaModel || 'ollama',
        updatedAt: new Date().toISOString(),
      };

      setActiveThread(updatedThread);
      upsertSavedThread(updatedThread, activeProfile);
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
      profileId: activeProfile.id,
      personId: activeProfile.personId,
      updatedAt: new Date().toISOString(),
      futureWindow: {
        startMonth,
        endMonth,
        transitDump: nextTransitDump,
      },
    };

    setActiveThread(updatedThread);
    upsertSavedThread(updatedThread, activeProfile);
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
      updatedAt: new Date().toISOString(),
    };

    setPrivateLlmError(null);
    setActiveThread(updatedThread);
    upsertSavedThread(updatedThread, activeProfile);
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
        profileId: activeProfile.id,
        personId: activeProfile.personId,
        messages: [...displayMessages, aiMsg],
        updatedAt: new Date().toISOString(),
      };

      setActiveThread(finalThread);
      upsertSavedThread(finalThread, activeProfile);
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

    const updatedWithUserMsg: AstroThread = {
      ...activeThread,
      profileId: activeProfile.id,
      personId: activeProfile.personId,
      messages: displayMessages,
      updatedAt: new Date().toISOString(),
    };
    setActiveThread(updatedWithUserMsg);
    upsertSavedThread(updatedWithUserMsg, activeProfile);

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
    <div className="h-screen w-screen overflow-hidden bg-transparent text-[#111827] dark:text-[#EDEFF5] flex relative">
      {/* LEFT SIDEBAR — FROSTED GLASS PANEL (RESIZABLE) */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="shrink-0 bg-white/75 dark:bg-white/[0.035] backdrop-blur-2xl border-r border-slate-900/10 dark:border-white/[0.1] shadow-[inset_-1px_0_0_rgba(255,255,255,0.6)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between relative"
      >
        <div className="p-3.5 space-y-3 border-b border-slate-900/10 dark:border-white/[0.09]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-[#111827] dark:text-[#EDEFF5]">
                Astro AI Studio
              </span>
              <button
                type="button"
                onClick={() => setModalMode(activeProfile ? 'edit' : 'create')}
                title="Settings (Profile, REST APIs & Gemini/Fable LLM Adapters)"
                aria-label="Settings"
                className="p-1.5 rounded-lg border border-slate-900/12 dark:border-white/15 bg-white/80 dark:bg-white/[0.05] backdrop-blur-md text-[#9A6712] dark:text-[#D4A853] hover:border-[#B47B1E]/60 dark:hover:border-[#D4A853]/70 hover:bg-white dark:hover:bg-white/[0.09] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
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
                className="w-full text-left bg-white/75 hover:bg-white dark:bg-white/[0.045] dark:hover:bg-white/[0.08] backdrop-blur-md border border-slate-900/10 dark:border-white/12 rounded-xl px-3 py-2.5 transition-colors flex items-center justify-between gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#111827] dark:text-[#EDEFF5] truncate">
                      {activeProfile.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#9A6712] dark:text-[#D4A853]">
                      {activeProfile.personId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#98A0B2] truncate mt-0.5">
                    {parsedNatal?.moonSign.split('(')[0].trim()} · Natal Loaded
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-[#98A0B2] shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModalMode('create')}
                className="w-full text-left bg-white/60 hover:bg-white/90 dark:bg-white/[0.04] dark:hover:bg-white/[0.075] backdrop-blur-md border border-dashed border-slate-900/20 dark:border-white/20 rounded-xl px-3 py-2.5 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#9A6712] dark:text-[#D4A853]">
                    Add Profile (personId)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#98A0B2] mt-0.5">
                    No profiles loaded
                  </div>
                </div>
                <UserPlus className="w-4 h-4 text-[#9A6712] dark:text-[#D4A853] shrink-0" />
              </button>
            )}

            {profileMenuOpen && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 bg-white/95 dark:bg-[#141925]/85 backdrop-blur-2xl border border-slate-900/12 dark:border-white/15 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_50px_rgba(0,0,0,0.55)]">
                <div className="py-1 max-h-56 overflow-y-auto">
                  {profiles.map((p) => {
                    const pParsed = parseNatalDump(p.natalDump, p.name);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-2.5 py-2 text-xs transition-colors ${
                          p.id === activeProfile?.id
                            ? 'bg-[#D4A853]/18 text-[#9A6712] dark:bg-[#D4A853]/15 dark:text-[#D4A853]'
                            : 'text-slate-800 hover:bg-slate-900/[0.05] dark:text-[#EDEFF5] dark:hover:bg-white/[0.07]'
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
                            <div className="text-[10px] text-slate-500 dark:text-[#98A0B2] truncate">
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
                          className="p-1 text-slate-400 hover:text-red-600 dark:text-[#7D8596] dark:hover:text-red-400 rounded transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-900/10 dark:border-white/10 p-1.5 flex flex-col gap-1">
                  {activeProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setModalMode('edit');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-900/[0.05] dark:text-[#C8CEDB] dark:hover:text-[#EDEFF5] dark:hover:bg-white/[0.07] rounded-lg transition-colors"
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
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#9A6712] dark:text-[#D4A853] hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.07] rounded-lg transition-colors flex items-center gap-1.5"
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
            <div className="bg-white/70 dark:bg-white/[0.04] backdrop-blur-md border border-slate-900/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="sidebar-person-id"
                className="text-[11px] font-mono text-slate-500 dark:text-[#98A0B2] whitespace-nowrap"
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
                      ? 'text-[#9A6712] dark:text-[#D4A853]'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(activeProfile.id)}
                  title={`Delete ${activeProfile.personId}`}
                  className="text-slate-400 hover:text-red-600 dark:text-[#7D8596] dark:hover:text-red-400 p-0.5 rounded transition-colors"
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
            className="w-full py-2 px-3 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 disabled:cursor-not-allowed text-[#111318] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-[0_8px_22px_rgba(212,168,83,0.25)]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Thread
          </button>
        </div>

        {/* Submitted Threads & Imported Threads Lists */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {/* Normal Threads */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#7D8596]">
              <span>Threads</span>
              <span className="font-mono tabular-nums">{normalThreads.length}</span>
            </div>

            {normalThreads.length === 0 ? (
              <div className="px-2.5 py-5 text-center border border-dashed border-slate-900/15 dark:border-white/12 bg-white/50 dark:bg-white/[0.02] backdrop-blur-md rounded-xl mx-1">
                <p className="text-xs text-slate-500 dark:text-[#98A0B2] leading-relaxed">
                  {activeProfile
                    ? 'Set your past & future periods, submit 1 Magic Card, and each reading lands here.'
                    : 'Create a profile first to start logging threads.'}
                </p>
              </div>
            ) : (
              normalThreads.map((t) => {
                const isSelected = activeThread.id === t.id;
                const isEditingThis = editingThreadId === t.id;
                const provider = resolveThreadProvider(t);
                const dt = new Date(t.submittedAt || t.createdAt);
                const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (!isEditingThis) handleSelectSavedThread(t);
                    }}
                    className={`group cursor-pointer rounded-xl px-2.5 py-2.5 transition-all border ${
                      isSelected
                        ? 'bg-white/90 border-[#B47B1E]/40 shadow-sm dark:bg-white/[0.09] dark:border-white/20 backdrop-blur-md dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                        : 'bg-transparent border-transparent hover:bg-white/60 hover:border-slate-900/10 dark:hover:bg-white/[0.045] dark:hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {isEditingThis ? (
                        <div
                          className="flex items-center gap-1 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCommitRenameThread(t.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelRenameThread(e);
                              }
                            }}
                            onBlur={() => handleCommitRenameThread(t.id)}
                            aria-label="Edit thread name"
                            className="flex-1 min-w-0 bg-white dark:bg-white/[0.08] border border-[#B47B1E] dark:border-[#D4A853]/70 rounded-md px-2 py-0.5 text-xs font-medium text-[#111827] dark:text-[#EDEFF5] outline-none"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCommitRenameThread(t.id);
                            }}
                            title="Save thread name"
                            aria-label="Save thread name"
                            className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 rounded transition-colors shrink-0"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleCancelRenameThread}
                            title="Cancel rename"
                            aria-label="Cancel rename"
                            className="p-1 text-slate-400 hover:text-slate-800 dark:text-[#7D8596] dark:hover:text-[#EDEFF5] rounded transition-colors shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {provider && (
                              <ProviderIcon
                                provider={provider}
                                model={t.primaryModel}
                                className="w-3.5 h-3.5"
                              />
                            )}
                            <p
                              className={`text-xs font-medium leading-snug truncate ${
                                isSelected
                                  ? 'text-[#111827] dark:text-[#EDEFF5]'
                                  : 'text-slate-700 dark:text-[#C8CEDB]'
                              }`}
                              title={t.title}
                            >
                              {t.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartRenameThread(e, t)}
                              className="opacity-45 group-hover:opacity-100 text-slate-400 hover:text-[#9A6712] dark:text-[#7D8596] dark:hover:text-[#D4A853] p-0.5 rounded transition-opacity shrink-0"
                              title="Edit thread name"
                              aria-label="Edit thread name"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteThread(e, t.id)}
                              className="opacity-45 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:text-[#7D8596] dark:hover:text-red-400 p-0.5 rounded transition-opacity shrink-0"
                              title="Delete thread"
                              aria-label="Delete thread"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-[#7D8596] mt-1">
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span>{timeStr}</span>
                      <span>·</span>
                      <span className="text-[#9A6712] dark:text-[#D4A853]/85">
                        {t.cards.length} {t.cards.length === 1 ? 'card' : 'cards'}
                      </span>
                      {t.step === 'narrative' && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500 dark:text-[#98A0B2]">Draft</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Imported Threads (below normal threads) */}
          <div className="border-t border-slate-900/10 dark:border-white/[0.08] pt-3 space-y-1">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#7D8596]">
              <span>Imported Threads</span>
              <span className="font-mono tabular-nums">{importedThreads.length}</span>
            </div>

            {importedThreads.length === 0 ? (
              <div className="px-2.5 py-4 text-center border border-dashed border-slate-900/15 dark:border-white/10 bg-white/40 dark:bg-white/[0.015] rounded-xl mx-1">
                <p className="text-[11px] text-slate-500 dark:text-[#7D8596] leading-relaxed">
                  Upload third-party <span className="font-mono text-slate-700 dark:text-[#98A0B2]">.md</span> or{' '}
                  <span className="font-mono text-slate-700 dark:text-[#98A0B2]">.html</span> files on the right panel.
                </p>
              </div>
            ) : (
              importedThreads.map((t) => {
                const isSelected = activeThread.id === t.id;
                const isEditingThis = editingThreadId === t.id;
                const dt = new Date(t.submittedAt || t.createdAt);
                const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const sourceName =
                  t.importedSource === 'claude'
                    ? 'Claude'
                    : t.importedSource === 'chatgpt'
                    ? 'ChatGPT'
                    : t.importedSource === 'gemini'
                    ? 'Gemini'
                    : 'External';
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (!isEditingThis) handleSelectSavedThread(t);
                    }}
                    className={`group cursor-pointer rounded-xl px-2.5 py-2.5 transition-all border ${
                      isSelected
                        ? 'bg-white/90 border-[#B47B1E]/40 shadow-sm dark:bg-white/[0.09] dark:border-white/20 backdrop-blur-md dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                        : 'bg-transparent border-transparent hover:bg-white/60 hover:border-slate-900/10 dark:hover:bg-white/[0.045] dark:hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {isEditingThis ? (
                        <div
                          className="flex items-center gap-1 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCommitRenameThread(t.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelRenameThread(e);
                              }
                            }}
                            onBlur={() => handleCommitRenameThread(t.id)}
                            aria-label="Edit imported thread name"
                            className="flex-1 min-w-0 bg-white dark:bg-white/[0.08] border border-[#B47B1E] dark:border-[#D4A853]/70 rounded-md px-2 py-0.5 text-xs font-medium text-[#111827] dark:text-[#EDEFF5] outline-none"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCommitRenameThread(t.id);
                            }}
                            title="Save thread name"
                            aria-label="Save thread name"
                            className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 rounded transition-colors shrink-0"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleCancelRenameThread}
                            title="Cancel rename"
                            aria-label="Cancel rename"
                            className="p-1 text-slate-400 hover:text-slate-800 dark:text-[#7D8596] dark:hover:text-[#EDEFF5] rounded transition-colors shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <ProviderIcon
                              importedSource={t.importedSource || 'other'}
                              provider={t.primaryProvider}
                              model={t.primaryModel}
                              className="w-3.5 h-3.5"
                            />
                            <p
                              className={`text-xs font-medium leading-snug truncate ${
                                isSelected
                                  ? 'text-[#111827] dark:text-[#EDEFF5]'
                                  : 'text-slate-700 dark:text-[#C8CEDB]'
                              }`}
                              title={t.title}
                            >
                              {t.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartRenameThread(e, t)}
                              className="opacity-45 group-hover:opacity-100 text-slate-400 hover:text-[#9A6712] dark:text-[#7D8596] dark:hover:text-[#D4A853] p-0.5 rounded transition-opacity shrink-0"
                              title="Edit thread name"
                              aria-label="Edit thread name"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteThread(e, t.id)}
                              className="opacity-45 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:text-[#7D8596] dark:hover:text-red-400 p-0.5 rounded transition-opacity shrink-0"
                              title="Delete thread"
                              aria-label="Delete thread"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-[#7D8596] mt-1">
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span>{timeStr}</span>
                      <span>·</span>
                      <span className="text-[#9A6712] dark:text-[#D4A853]/85">{sourceName}</span>
                      {t.importFormat && (
                        <>
                          <span>·</span>
                          <span className="uppercase">{t.importFormat}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Theme Switcher */}
        <div className="px-3.5 py-2 border-t border-slate-900/10 dark:border-white/[0.09] bg-white/40 dark:bg-white/[0.015] flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-[#7D8596]">
            Theme
          </span>
          <div
            role="group"
            aria-label="Workspace theme"
            className="inline-flex items-center rounded-lg p-0.5 border border-slate-900/10 dark:border-white/12 bg-slate-900/[0.05] dark:bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => setAppTheme('primary')}
              aria-pressed={appTheme === 'primary'}
              title="Primary Obsidian Gold dark theme"
              className={`px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                appTheme === 'primary'
                  ? 'bg-[#D4A853]/18 text-[#D4A853] border border-[#D4A853]/40 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#98A0B2] dark:hover:text-[#EDEFF5] border border-transparent'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span>Primary</span>
            </button>
            <button
              type="button"
              onClick={() => setAppTheme('daylight')}
              aria-pressed={appTheme === 'daylight'}
              title="Daylight Alabaster light theme"
              className={`px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                appTheme === 'daylight'
                  ? 'bg-white text-[#9A6712] border border-[#B47B1E]/35 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#98A0B2] dark:hover:text-[#EDEFF5] border border-transparent'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>Daylight</span>
            </button>
          </div>
        </div>

        {/* Footer: Active LLM Adapter & Natal Load */}
        <div className="px-4 py-2.5 border-t border-slate-900/10 dark:border-white/[0.09] bg-white/55 dark:bg-white/[0.02] text-[11px] text-slate-500 dark:text-[#7D8596] flex items-center justify-between gap-2">
          <span className="font-mono uppercase text-[#9A6712] dark:text-[#D4A853] truncate">
            {apiConfig.llmProvider === 'ollama'
              ? `Private · ${apiConfig.ollamaModel || 'Ollama'}`
              : apiConfig.llmProvider === 'fable'
              ? 'Fable LLM'
              : 'Gemini LLM'}
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-[#98A0B2] shrink-0">
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
      <main className="flex-1 min-w-0 flex flex-col bg-transparent relative">
        {/* Minimal Clean Top Bar */}
        <header className="h-12 shrink-0 border-b border-slate-900/10 dark:border-white/[0.09] px-6 flex items-center justify-between gap-3 bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl shadow-[inset_0_-1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
          <span className="text-xs font-medium text-[#111827] dark:text-[#EDEFF5] truncate">
            {activeThread.isImported && activeThread.step === 'reading'
              ? activeThread.title
              : activeProfile
              ? activeThread.step === 'reading'
                ? activeThread.title
                : activeThread.title && activeThread.title !== 'New Thread'
                ? `${activeProfile.name} (${activeProfile.personId}) · ${activeThread.title}`
                : `${activeProfile.name} (${activeProfile.personId})`
              : 'Profile Setup Required'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {(activeProfile || activeThread.isImported) && activeThread.step === 'reading' && (
              <button
                type="button"
                onClick={(e) => handleDeleteThread(e, activeThread.id)}
                title="Delete thread"
                className="px-2.5 py-1 rounded-lg border border-slate-900/12 dark:border-white/12 bg-white/75 dark:bg-white/[0.04] backdrop-blur-md hover:border-red-400/50 hover:bg-red-50 dark:hover:border-red-400/40 dark:hover:bg-red-500/15 text-[11px] text-slate-600 dark:text-[#98A0B2] hover:text-red-700 dark:hover:text-red-200 inline-flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Thread</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRightImportOpen((v) => !v)}
              title="Toggle right-hand MD/HTML upload panel"
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                rightImportOpen
                  ? 'border-[#B47B1E]/45 bg-[#D4A853]/15 text-[#9A6712] dark:border-[#D4A853]/50 dark:bg-[#D4A853]/15 dark:text-[#D4A853]'
                  : 'border-slate-900/12 bg-white/75 hover:bg-white text-slate-700 dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-[#C8CEDB]'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload MD</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {activeThread.isImported && activeThread.step === 'reading' ? (
              <OpenedCardSpread
                thread={activeThread}
                hasActiveProfile={Boolean(activeProfile)}
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
                isBuildingTimeline={buildingTimelineThreadId === activeThread.id}
                timelineBuildError={timelineBuildError}
                onRetryTimelineBuild={(cardId, sourceTab) =>
                  runPrivateTimelineDecision(activeThread, cardId, sourceTab)
                }
                onApplyManualTimelineJson={(cardId, sourceTab, data) =>
                  attachGrahaTimelineToThread(
                    activeThread.id,
                    cardId,
                    sourceTab,
                    data,
                    activeThread
                  )
                }
              />
            ) : !activeProfile ? (
              <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-900/10 dark:border-white/12 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl p-8 text-center space-y-4 mt-8">
                <h1 className="text-lg font-semibold text-[#111827] dark:text-[#EDEFF5]">
                  Set Up Your Profile (personId) &amp; Natal Dump
                </h1>
                <p className="text-sm text-slate-600 dark:text-[#98A0B2] max-w-lg mx-auto leading-relaxed">
                  Enter your 5–7 character <span className="font-mono text-[#9A6712] dark:text-[#D4A853]">personId</span> (e.g., <span className="font-mono text-[#111827] dark:text-[#EDEFF5]">001ME</span>), configure your REST APIs and LLM Adapter (Gemini or Fable), and load your Natal Dump once for the session.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setModalMode('create')}
                    className="px-5 py-2.5 bg-[#D4A853] hover:bg-[#DFB96B] text-[#111318] text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2 shadow-[0_8px_22px_rgba(212,168,83,0.25)]"
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
                        className={`absolute w-56 h-36 overflow-hidden rounded-2xl border p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_45px_rgba(0,0,0,0.45)] flex flex-col justify-between ${cTheme.surfaceGradient} ${cTheme.activeBorderClass}`}
                        style={{ backgroundImage: cTheme.ambientGlow }}
                      >
                        <div className="relative z-10 flex items-center justify-between text-[11px]">
                          <span className={`inline-flex items-center gap-1.5 font-medium ${cTheme.accentText}`}>
                            <CardIcon className="w-3.5 h-3.5" />
                            <span>{cTheme.label}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-white/50">
                            {card.eventDate}
                          </span>
                        </div>
                        <div className="relative z-10 text-xs font-semibold text-[#111827] dark:text-[#EDEFF5] line-clamp-2">
                          {card.title}
                        </div>
                        <div className="relative z-10 text-[10px] text-slate-600 dark:text-white/65 line-clamp-1">
                          {card.question}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="text-center space-y-1.5 max-w-lg mx-auto">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-[#EDEFF5]">
                    <Sparkles className="w-4 h-4 text-[#9A6712] dark:text-[#D4A853] animate-pulse" />
                    <span>
                      Exploring Realistic Possibilities (
                      {formatMonthRangeLabel(
                        activeThread.futureWindow.startMonth,
                        activeThread.futureWindow.endMonth
                      )}
                      )...
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#8E95A5] leading-relaxed">
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
                  <div className="max-w-xl mx-auto mt-6 bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-900/10 dark:border-white/12 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl p-6 space-y-5">
                    <div>
                      <div className="text-[11px] font-mono text-[#9A6712] dark:text-[#D4A853] mb-1">
                        STEP 1 OF 3
                      </div>
                      <h1 className="text-lg font-semibold text-[#111827] dark:text-[#EDEFF5]">
                        Set Past Narrative Period
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-[#98A0B2] mt-1">
                        Select From and To (1–3 months max) and click Set to load this window.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-[#98A0B2] mb-1.5">
                          From
                        </label>
                        <select
                          value={activeThread.narrativeWindow.startMonth}
                          onChange={(e) =>
                            updateNarrativeWindow({ startMonth: e.target.value })
                          }
                          className="w-full bg-white/90 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/12 dark:border-white/12 focus:border-[#B47B1E] dark:focus:border-[#D4A853] rounded-xl px-3 py-2.5 text-sm text-[#111827] dark:text-[#EDEFF5] outline-none transition-colors"
                        >
                          {MONTH_YEAR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-[#98A0B2] mb-1.5">
                          To
                        </label>
                        <select
                          value={activeThread.narrativeWindow.endMonth}
                          onChange={(e) =>
                            updateNarrativeWindow({ endMonth: e.target.value })
                          }
                          className="w-full bg-white/90 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/12 dark:border-white/12 focus:border-[#B47B1E] dark:focus:border-[#D4A853] rounded-xl px-3 py-2.5 text-sm text-[#111827] dark:text-[#EDEFF5] outline-none transition-colors"
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
                      <p className="text-xs text-red-600 dark:text-red-400">{timelineError}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900/10 dark:border-white/10">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isNarrativeValid ? 'text-slate-500 dark:text-[#98A0B2]' : 'text-red-600 dark:text-red-400'
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
                        className="px-5 py-2 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold rounded-xl transition-colors shadow-[0_6px_18px_rgba(212,168,83,0.25)]"
                      >
                        {settingPast ? 'Setting...' : 'Set'}
                      </button>
                    </div>
                  </div>
                ) : !futureSet ? (
                  /* STAGE 2: SET FUTURE TARGET PERIOD (FROM & TO DROPDOWNS + SET) */
                  <div className="max-w-xl mx-auto mt-6 space-y-4">
                    <div className="bg-white/75 dark:bg-white/[0.04] backdrop-blur-xl border border-slate-900/10 dark:border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-[#C8CEDB]">
                        Past Narrative:{' '}
                        <span className="text-[#9A6712] dark:text-[#D4A853] font-medium">
                          {formatMonthRangeLabel(
                            activeThread.narrativeWindow.startMonth,
                            activeThread.narrativeWindow.endMonth
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPastSet(false)}
                        className="text-slate-500 hover:text-slate-900 dark:text-[#98A0B2] dark:hover:text-[#EDEFF5] text-[11px]"
                      >
                        Change
                      </button>
                    </div>

                    <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-900/10 dark:border-white/12 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl p-6 space-y-5">
                      <div>
                        <div className="text-[11px] font-mono text-[#9A6712] dark:text-[#D4A853] mb-1">
                          STEP 2 OF 3
                        </div>
                        <h1 className="text-lg font-semibold text-[#111827] dark:text-[#EDEFF5]">
                          Set Future Target Period
                        </h1>
                        <p className="text-xs text-slate-600 dark:text-[#98A0B2] mt-1">
                          Select From and To (1–3 months max) and click Set to deal your Magic Card.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-[#98A0B2] mb-1.5">
                            From
                          </label>
                          <select
                            value={activeThread.futureWindow.startMonth}
                            onChange={(e) =>
                              updateFutureWindow({ startMonth: e.target.value })
                            }
                            className="w-full bg-white/90 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/12 dark:border-white/12 focus:border-[#B47B1E] dark:focus:border-[#D4A853] rounded-xl px-3 py-2.5 text-sm text-[#111827] dark:text-[#EDEFF5] outline-none transition-colors"
                          >
                            {MONTH_YEAR_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-[#98A0B2] mb-1.5">
                            To
                          </label>
                          <select
                            value={activeThread.futureWindow.endMonth}
                            onChange={(e) =>
                              updateFutureWindow({ endMonth: e.target.value })
                            }
                            className="w-full bg-white/90 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/12 dark:border-white/12 focus:border-[#B47B1E] dark:focus:border-[#D4A853] rounded-xl px-3 py-2.5 text-sm text-[#111827] dark:text-[#EDEFF5] outline-none transition-colors"
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
                        <p className="text-xs text-red-600 dark:text-red-400">{timelineError}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900/10 dark:border-white/10">
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isFutureValid ? 'text-slate-500 dark:text-[#98A0B2]' : 'text-red-600 dark:text-red-400'
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
                          className="px-5 py-2 bg-[#D4A853] hover:bg-[#DFB96B] disabled:opacity-40 text-[#111318] text-xs font-semibold rounded-xl transition-colors shadow-[0_6px_18px_rgba(212,168,83,0.25)]"
                        >
                          {settingFuture ? 'Setting...' : 'Set'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STAGE 3: MAGIC CARD (1 PER THREAD) + SUBMIT CARD */
                  <div className="space-y-5">
                    <div className="bg-white/75 dark:bg-white/[0.04] backdrop-blur-xl border border-slate-900/10 dark:border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-[#C8CEDB]">
                        <span>
                          Past:{' '}
                          <span className="text-[#9A6712] dark:text-[#D4A853] font-medium">
                            {formatMonthRangeLabel(
                              activeThread.narrativeWindow.startMonth,
                              activeThread.narrativeWindow.endMonth
                            )}
                          </span>
                        </span>
                        <span className="text-slate-400 dark:text-white/30">→</span>
                        <span>
                          Future:{' '}
                          <span className="text-[#111827] dark:text-[#EDEFF5] font-medium">
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
                        className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-[#98A0B2] dark:hover:text-[#EDEFF5]"
                      >
                        Change Future Period
                      </button>
                    </div>

                    {analyzeError && (
                      <div className="bg-red-50 dark:bg-red-500/12 backdrop-blur-md border border-red-300 dark:border-red-400/30 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-200">
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
                      onDraftTitleChange={(draftTitle) => {
                        const cleanTitle = draftTitle.trim() || 'New Thread';
                        setActiveThread((prev) => {
                          if (prev.cards.length > 0 && prev.cards[0].title.trim()) {
                            return prev;
                          }
                          return {
                            ...prev,
                            title: cleanTitle,
                            updatedAt: new Date().toISOString(),
                          };
                        });
                      }}
                      onChangeCards={(cards) => {
                        const nextTitle =
                          activeThread.isCustomTitle && activeThread.title.trim()
                            ? activeThread.title.trim()
                            : cards
                                .map((c) => c.title.trim())
                                .filter(Boolean)
                                .join(' · ') || 'New Thread';
                        const updated: AstroThread = {
                          ...activeThread,
                          profileId: activeProfile?.id || activeThread.profileId,
                          personId: activeProfile?.personId || activeThread.personId,
                          cards,
                          title: nextTitle,
                          updatedAt: new Date().toISOString(),
                        };
                        setActiveThread(updated);
                        if (cards.length > 0 || savedThreadsRef.current.some((t) => t.id === updated.id)) {
                          upsertSavedThread(updated, activeProfile);
                        }
                      }}
                      onSubmitThread={handleSubmitThread}
                      onCopyImportPrompt={handleCopyImportCardPrompt}
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
                isBuildingTimeline={buildingTimelineThreadId === activeThread.id}
                timelineBuildError={timelineBuildError}
                onRetryTimelineBuild={(cardId, sourceTab) =>
                  runPrivateTimelineDecision(activeThread, cardId, sourceTab)
                }
                onApplyManualTimelineJson={(cardId, sourceTab, data) =>
                  attachGrahaTimelineToThread(
                    activeThread.id,
                    cardId,
                    sourceTab,
                    data,
                    activeThread
                  )
                }
              />
            )}
          </div>
        </div>

        {/* BOTTOM COMPLETE-PROMPT BAR (CONSULTING STATE + READING INSPECTOR) */}
        {activeProfile &&
          !activeThread.isImported &&
          fullConsultingPrompt &&
          (isAnalyzing || activeThread.step === 'reading') && (
            <div className="shrink-0 border-t border-slate-900/10 dark:border-white/[0.09] bg-white/75 dark:bg-white/[0.035] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {showFullPromptPreview && (
                <div className="border-b border-slate-900/10 dark:border-white/[0.09] bg-slate-900/[0.03] dark:bg-black/25 backdrop-blur-xl px-6 py-3">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#9A6712] dark:text-[#D4A853]">
                        Complete 3-Fold Prompt Dump (System + Natal + Past + Cards + Future)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#7D8596]">
                        {fullConsultingPrompt.fullCombinedPrompt.length.toLocaleString()} chars · ~
                        {Math.ceil(fullConsultingPrompt.fullCombinedPrompt.length / 4).toLocaleString()} tok
                      </span>
                    </div>
                    <pre className="max-h-72 overflow-y-auto rounded-xl border border-slate-900/10 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] backdrop-blur-md p-3 text-[11px] leading-relaxed font-mono text-slate-800 dark:text-[#C8CDD8] whitespace-pre-wrap break-words select-all">
                      {fullConsultingPrompt.fullCombinedPrompt}
                    </pre>
                  </div>
                </div>
              )}

              <div className="px-6 py-2.5">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-mono uppercase tracking-wider text-[#9A6712] dark:text-[#D4A853]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isAnalyzing ? 'bg-[#B47B1E] dark:bg-[#D4A853] animate-pulse' : 'bg-emerald-500 dark:bg-emerald-400'
                        }`}
                      />
                      {isAnalyzing ? 'Consulting Prompt' : 'Complete Prompt'}
                    </span>
                    <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#7D8596] shrink-0">
                      {fullConsultingPrompt.fullCombinedPrompt.length.toLocaleString()} chars
                    </span>
                    <span className="text-xs font-mono text-slate-600 dark:text-[#98A0B2] truncate">
                      {fullConsultingPrompt.userPrompt.replace(/\s+/g, ' ').slice(0, 140)}…
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowFullPromptPreview((v) => !v)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-900/12 dark:border-white/12 bg-white/80 hover:bg-white dark:bg-white/[0.045] dark:hover:bg-white/[0.09] backdrop-blur-md text-[11px] font-medium text-slate-700 dark:text-[#C8CEDB] inline-flex items-center gap-1.5 transition-colors"
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
                      onClick={() => void handleCopyImportCardPrompt()}
                      title="Copy condensed Import Card prompt (decorations stripped, all data intact) for Claude or ChatGPT"
                      aria-label="Copy condensed Import Card prompt"
                      className={`px-3 py-1.5 rounded-lg border backdrop-blur-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        copiedCondensedPrompt
                          ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'border-slate-900/12 bg-white/80 hover:bg-white text-slate-800 dark:border-white/15 dark:bg-white/[0.045] dark:hover:bg-white/[0.09] dark:text-[#EDEFF5]'
                      }`}
                    >
                      {copiedCondensedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Import Prompt</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#9A6712] dark:text-[#D4A853]" />
                          <span>Copy Condensed</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyFullPrompt}
                      title="Copy entire constructed prompt dump to clipboard"
                      aria-label="Copy entire constructed prompt dump to clipboard"
                      className={`px-3 py-1.5 rounded-lg border backdrop-blur-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        copiedPrompt
                          ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'border-[#B47B1E]/40 bg-[#D4A853]/15 hover:bg-[#D4A853]/25 text-[#9A6712] dark:border-[#D4A853]/45 dark:bg-[#D4A853]/12 dark:hover:bg-[#D4A853]/22 dark:text-[#D4A853]'
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

      <RightImportPanel
        isOpen={rightImportOpen}
        onClose={() => setRightImportOpen(false)}
        onImportContent={handleImportReport}
      />

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
