import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema, type Criteria } from "../data/criteria";
import { destinations } from "../data/destinations";

// Maps criteria keys to the label strings used in the destinations catalog.
// "acces_handicap" is excluded here — it maps to a dedicated field, not a label.
const criteriaKeyToDestinationLabel: Record<string, string> = {
  plage: "plage",
  montagne: "montagne",
  ville: "ville",
  sport: "sport",
  detente: "détente", // accent required to match the destinations data
};

type DestinationResult = {
  nom: string;
  score: number;
  accessibleHandicap: "oui" | "non";
  matchedLabels: string[];
};

// Scores every destination against the user's active criteria and returns the best match.
function pickBestDestination(criteria: Criteria): DestinationResult | null {
  const activeCriteriaKeys = Object.entries(criteria)
    .filter(([key, value]) => key !== "suggestedDestinations" && value === true)
    .map(([key]) => key);

  if (activeCriteriaKeys.length === 0) return null;

  const scored = destinations.map((destination) => {
    let score = 0;
    const matchedLabels: string[] = [];

    for (const criteriaKey of activeCriteriaKeys) {
      if (criteriaKey === "acces_handicap") {
        // Accessibility is stored as a separate boolean field, not a label
        if (destination.accessibleHandicap === "oui") {
          score += 1;
          matchedLabels.push("acces_handicap");
        }
      } else {
        const destinationLabel = criteriaKeyToDestinationLabel[criteriaKey];
        if (destinationLabel && destination.labels.includes(destinationLabel)) {
          score += 1;
          matchedLabels.push(destinationLabel);
        }
      }
    }

    return { nom: destination.nom, score, accessibleHandicap: destination.accessibleHandicap, matchedLabels };
  });

  const matches = scored
    .filter((destination) => destination.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0] ?? null;
}

// The single Mastra tool for this agent.
// Called on every user message — extracts criteria from the message and picks the best matching destination.
export const tripGuidanceTool = createTool({
  id: "trip-guidance",
  description: "Call this on every user message. Extracts travel criteria and picks the best matching destination.",
  inputSchema: z.object({
    userMessage: z.string().describe("The raw user message"),
    criteria: criteriaSchema.describe(
      "Criteria extracted from the user message. " +
      "true = positive preference expressed, false = negative preference expressed, null = not mentioned."
    ),
    isUnclearMessage: z
      .boolean()
      .default(false)
      .describe(
        "Set to true if the message is gibberish or completely unrelated to travel. " +
        "Set to false for valid messages even if they express no preference (e.g. 'oui', 'non', greetings)."
      ),
  }),
  outputSchema: z.object({
    hasAnyCriteria: z.boolean(),
    isUnclearMessage: z.boolean(),
    topMatch: z
      .object({
        nom: z.string(),
        score: z.number(),
        accessibleHandicap: z.enum(["oui", "non"]),
        matchedLabels: z.array(z.string()),
      })
      .nullable(),
  }),
  execute: async ({ criteria, isUnclearMessage }) => {
    const hasAnyCriteria = Object.values(criteria).some((value) => value === true);
    const topMatch = pickBestDestination(criteria);

    return { hasAnyCriteria, isUnclearMessage, topMatch };
  },
});
