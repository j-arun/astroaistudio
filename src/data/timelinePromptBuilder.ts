export interface TimelinePromptInput {
  domain: string;
  title: string;
  eventDate: string;
  question: string;
  pastRangeLabel: string;
  futureRangeLabel: string;
  verdictSummary: string;
  timingWindow: string;
  planetaryTriggers: string;
}

export function buildTimelineDecisionPrompt(input: TimelinePromptInput): {
  systemInstruction: string;
  userPrompt: string;
} {
  const systemInstruction = `You are a time-based, timeline-based decision engine analyzing an astrological reasoning narrative produced by a public LLM.

STRICT GROUNDING RULES:
1. Work ONLY from the narrative reasoning and card timeline provided below. Do NOT invent new planets, houses, dashas, or placements not mentioned in the narrative.
2. Focus on how the decision/outcome transforms over time:
   - Where momentum gets PULLED BACK (holds, delays, friction, restraint)
   - Where a PIVOT / SHIFT occurs
   - Where momentum FLOWS FORWARD (openings, breakthroughs, manifestations)
3. Identify WHO holds the primary key/lever for the question based on the narrative.
4. Return strictly valid JSON matching the exact schema requested.`;

  const userPrompt = `CONTEXT CARD:
- Domain: ${input.domain}
- Past Event (${input.eventDate}, inside ${input.pastRangeLabel}): ${input.title}
- User Question for Future Period (${input.futureRangeLabel}): ${input.question}
- Public LLM Real-World Outlook: ${input.verdictSummary}
- Peak Timing Window: ${input.timingWindow || input.futureRangeLabel}

PUBLIC LLM REASONING NARRATIVE:
${input.planetaryTriggers}

Build a chronological 4-stage timeline decision flow showing how this outcome gets pulled back or flows across time (${input.pastRangeLabel} -> bridge -> ${input.futureRangeLabel}).
For each stage, set:
- "direction": "pullback" | "shift" | "flow"
- "flowScore": integer 0 to 100 (0-44 = Pulled Back / Hold, 45-59 = Pivot / Shift, 60-100 = Flow / Opening)

Return JSON strictly matching:
{
  "keyHolder": {
    "name": "Primary planet/dasha/house holding the key from the narrative",
    "role": "Short role label (e.g. Primary Gatekeeper & Trigger)",
    "why": "1-2 concise sentences explaining why this factor holds the key"
  },
  "factors": [
    {
      "name": "Planet / House / Transit / Bindu from the narrative",
      "role": "Key Holder | Pullback Driver | Flow Catalyst | Anchor",
      "impact": "1 short sentence on whether it pulls back or moves forward"
    }
  ],
  "stages": [
    {
      "phase": "Initial Hold",
      "dateRange": "Early baseline / prior period",
      "stateLabel": "2-4 word state label",
      "direction": "pullback",
      "flowScore": 30,
      "trigger": "Exact factor from narrative holding or starting the pattern",
      "explanation": "1-2 sentences on why things are held or primed here"
    },
    {
      "phase": "Past Calibration",
      "dateRange": "${input.pastRangeLabel}",
      "stateLabel": "2-4 word state label",
      "direction": "shift",
      "flowScore": 48,
      "trigger": "Transit/event trigger during ${input.eventDate}",
      "explanation": "1-2 sentences on how the past event reflected this pattern"
    },
    {
      "phase": "Turning Point",
      "dateRange": "Transition window",
      "stateLabel": "2-4 word state label",
      "direction": "shift",
      "flowScore": 62,
      "trigger": "Transit/aspect/bhukti shift changing the state",
      "explanation": "1-2 sentences on what shifts the pullback"
    },
    {
      "phase": "Target Flow",
      "dateRange": "${input.timingWindow || input.futureRangeLabel}",
      "stateLabel": "2-4 word state label",
      "direction": "flow",
      "flowScore": 82,
      "trigger": "Primary trigger inside ${input.futureRangeLabel}",
      "explanation": "1-2 sentences on the resulting state in the target period"
    }
  ],
  "edges": [
    {
      "from": "Source planet/transit",
      "relation": "Aspect / Transit / Pullback / Unlocks",
      "to": "Target house/planet/state",
      "effect": "Short explanation of how this transforms the timeline"
    }
  ]
}`;

  return { systemInstruction, userPrompt };
}
