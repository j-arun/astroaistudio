export type CardDomain =
  | 'Love'
  | 'Career'
  | 'Financial'
  | 'Education'
  | 'Health'
  | 'Family'
  | 'Travel'
  | 'Finance';

export type ThreadStep = 'narrative' | 'reading';

export type LlmProvider = 'gemini' | 'fable' | 'ollama';

export interface HousePlacement {
  sign: string;
  signIndex: number; // 0 = Aries .. 11 = Pisces
  house: number; // 1..12
  planets: string[];
  savBindus: number;
}

export interface ParsedNatalSummary {
  name: string;
  lagna: string;
  moonSign: string;
  nakshatra: string;
  currentDasha: string;
  d1Houses: HousePlacement[];
  divisionalHighlights: Record<string, string>;
  savTotal: number;
  bavHighlights: Array<{ planet: string; sign: string; bindus: number }>;
  tokenEstimate: number;
}

export interface StudioApiConfig {
  baseApiUrl: string;
  natalEndpointPath: string;
  transitEndpointPath: string;
  apiBearerToken: string;
  llmProvider: LlmProvider;
  geminiModel: string;
  fableEndpointUrl: string;
  fableModel: string;
  fableApiKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export interface AstroProfile {
  id: string;
  personId: string; // 5 to 7 alphanumeric chars, e.g. 001ME
  name: string;
  roleLabel: string;
  natalDump: string;
  updatedAt: string;
}

export interface TimelineStage {
  phase: string;
  dateRange: string;
  stateLabel: string;
  direction: 'pullback' | 'shift' | 'flow';
  flowScore: number; // 0..100 (0-44 Pulled Back, 45-59 Shift, 60-100 Flow)
  trigger: string;
  explanation: string;
}

export interface TimelineFactor {
  name: string;
  role: string;
  impact: string;
}

export interface TimelineTransitionEdge {
  from: string;
  relation: string;
  to: string;
  effect: string;
}

export interface TimelineDecisionFlow {
  generatedByModel?: string;
  keyHolder: {
    name: string;
    role: string;
    why: string;
  };
  factors: TimelineFactor[];
  stages: TimelineStage[];
  edges: TimelineTransitionEdge[];
}

export interface CardReading {
  verdictSummary: string;
  planetaryTriggers: string;
  timingWindow: string;
  guidance: string;
  timelineFlow?: TimelineDecisionFlow;
}

export interface MagicCard {
  id: string;
  domain: CardDomain;
  title: string;
  eventDate: string; // Typed YYYY-MM-DD inside narrativeWindow
  narrative: string;
  question: string;
  reading?: CardReading;
  privateReading?: CardReading;
}

export interface TransitWindow {
  startMonth: string; // YYYY-MM
  endMonth: string; // YYYY-MM (max 3 months span inclusive)
  transitDump: string;
}

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: LlmProvider;
  referencedCardIds?: string[];
  timestamp: string;
}

export interface AstroThread {
  id: string;
  profileId: string;
  title: string;
  createdAt: string;
  submittedAt?: string;
  step: ThreadStep;
  primaryProvider?: LlmProvider;
  narrativeWindow: TransitWindow;
  cards: MagicCard[];
  futureWindow: TransitWindow;
  overallSynthesis?: string;
  privateOverallSynthesis?: string;
  privateModel?: string;
  messages: ThreadMessage[];
}
