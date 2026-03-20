import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema } from "../data/criteria";
import { destinations, criteriaToLabel } from "../data/destinations";

const destinationResultSchema = z.object({
  nom: z.string(),
  score: z.number(),
  accessibleHandicap: z.enum(["oui", "non"]),
  matchedLabels: z.array(z.string()),
});

export const saveCriteriaTool = createTool({
  id: "save-criteria",
  description:
    "Call this on every user message. Updates criteria, picks the best destination, and tracks suggestion history.",
  inputSchema: z.object({
    userMessage: z.string().describe("The raw user message"),
    updatedCriteria: criteriaSchema.describe(
      "The FULL updated criteria object — merge current working memory state with what the user just expressed. " +
      "true = positive preference, false = negative/contradiction, null = unchanged."
    ),
    isUnclearMessage: z
      .boolean()
      .describe(
        "Set to true if the message is gibberish (random characters, nonsense strings) or completely unrelated to travel. " +
        "Set to false for valid messages even if they express no preference (e.g. 'oui', 'non', greetings)."
      ),
  }),
  outputSchema: z.object({
    updatedCriteria: criteriaSchema,
    hasAnyCriteria: z.boolean(),
    isUnclearMessage: z.boolean(),
    topMatch: destinationResultSchema.nullable(),
    alreadySuggested: z.boolean(),
  }),
  execute: async ({ updatedCriteria, isUnclearMessage }) => {
    // 1. Compute hasAnyCriteria
    const hasAnyCriteria = Object.entries(updatedCriteria)
      .filter(([k]) => k !== "suggestedDestinations")
      .some(([, v]) => v === true);

    // 2. Pick best destination
    const activeCriteria = Object.entries(updatedCriteria)
      .filter(([k, v]) => v === true && k !== "suggestedDestinations")
      .map(([k]) => k);

    const scored = destinations
      .map((dest) => {
        let score = 0;
        const matchedLabels: string[] = [];
        for (const key of activeCriteria) {
          if (key === "acces_handicap") {
            if (dest.accessibleHandicap === "oui") {
              score += 1;
              matchedLabels.push("acces_handicap");
            }
          } else {
            const label = criteriaToLabel[key];
            if (label && dest.labels.includes(label)) {
              score += 1;
              matchedLabels.push(label);
            }
          }
        }
        return { nom: dest.nom, score, accessibleHandicap: dest.accessibleHandicap, matchedLabels };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score);

    const topMatch = scored[0] ?? null;

    // 3. Track suggestion history
    const currentSuggested = updatedCriteria.suggestedDestinations ?? [];
    const alreadySuggested = topMatch
      ? currentSuggested.includes(topMatch.nom)
      : false;

    const newSuggestedDestinations =
      topMatch && !alreadySuggested
        ? [...currentSuggested, topMatch.nom]
        : currentSuggested;

    const finalCriteria = {
      ...updatedCriteria,
      suggestedDestinations: newSuggestedDestinations,
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
