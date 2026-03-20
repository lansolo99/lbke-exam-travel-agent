import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema, type Criteria } from "../data/criteria";
import { destinations } from "../data/destinations";

// Maps criteria keys (from working memory) to the label strings used in the destinations catalog.
// "acces_handicap" is excluded here — it maps to a dedicated field, not a label.
const criteriaKeyToDestinationLabel: Record<string, string> = {
  plage: "plage",
  montagne: "montagne",
  ville: "ville",
  sport: "sport",
  detente: "détente",
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

    return {
      nom: destination.nom,
      score,
      accessibleHandicap: destination.accessibleHandicap,
      matchedLabels,
    };
  });

  const matches = scored
    .filter((destination) => destination.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0] ?? null;
}

// Complete pipeline.
export const tripGuidanceTool = createTool({
  id: "trip-guidance",
  description:
    "Call this on every user message. Validates criteria, picks the best matching destination, and tracks suggestion history.",
  inputSchema: z.object({
    userMessage: z.string().describe("The raw user message"),
    updatedCriteria: criteriaSchema.describe(
      "The FULL updated criteria object: merge current working memory state with what the user just expressed. " +
        "true = positive preference, false = negative/contradiction, null = unchanged.",
    ),
    isUnclearMessage: z
      .boolean()
      .describe(
        "Set to true if the message is gibberish (random characters, nonsense strings) or completely unrelated to travel. " +
          "Set to false for valid messages even if they express no preference (e.g. 'oui', 'non', greetings).",
      ),
  }),
  outputSchema: z.object({
    updatedCriteria: criteriaSchema,
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
    alreadySuggested: z.boolean(),
  }),
  execute: async ({ updatedCriteria, isUnclearMessage }) => {
    // Does the user have at least one positive preference?
    const hasAnyCriteria = Object.entries(updatedCriteria)
      .filter(([key]) => key !== "suggestedDestinations")
      .some(([, value]) => value === true);

    // Find the best destination given current criteria
    const topMatch = pickBestDestination(updatedCriteria);

    // Was this destination already suggested earlier in this thread?
    const previouslySuggested = updatedCriteria.suggestedDestinations ?? [];
    const alreadySuggested =
      topMatch !== null && previouslySuggested.includes(topMatch.nom);

    // Append the new suggestion to the history (only if it's a first-time suggestion)
    const updatedSuggestedDestinations =
      topMatch !== null && !alreadySuggested
        ? [...previouslySuggested, topMatch.nom]
        : previouslySuggested;

    const finalCriteria: Criteria = {
      ...updatedCriteria,
      suggestedDestinations: updatedSuggestedDestinations,
    };

    return {
      updatedCriteria: finalCriteria,
      hasAnyCriteria,
      isUnclearMessage,
      topMatch,
      alreadySuggested,
    };
  },
});
