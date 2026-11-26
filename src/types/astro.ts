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

export interface GrahaPlanetSpec {
  name: string;
  role?: string;
}

export interface GrahaRetrogradeSpec {
  planet: string;
  from: string; // YYYY-MM-DD
  to?: string; // optional YYYY-MM-DD
}

export interface GrahaLinkSpec {
  from: string;
  to: string;
  from_date: string; // YYYY-MM-DD
}

export interface GrahaFactorSpec {
  planet: string;
  polarity: 'support' | 'friction';
  strength: number; // 1 to 5
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  tag?: string;
  reasoning: string;
  why_strength?: string;
}

export interface GrahaTimelineData {
  generatedByProvider?: LlmProvider;
  generatedByModel?: string;
  title: string;
  outcome_label: string;
  window: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
  dasha_line: string;
  planets: GrahaPlanetSpec[];
  retrograde?: GrahaRetrogradeSpec[];
  links?: GrahaLinkSpec[];
  factors: GrahaFactorSpec[];
  review_flags?: string[];
}

export interface CardReading {
  verdictSummary: string;
  planetaryTriggers: string;
  timingWindow: string;
  guidance: string;
  grahaTimeline?: GrahaTimelineData;
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
