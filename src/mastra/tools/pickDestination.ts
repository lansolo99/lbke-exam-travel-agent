import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema } from "../data/criteria";
import { destinations, criteriaToLabel } from "../data/destinations";

export const pickDestinationTool = createTool({
  id: "pick-destination",
  description:
    "Scores all destinations against the current user criteria and returns the best matches. " +
    "Only call this tool when at least one criterion is set to true.",
  inputSchema: z.object({
    criteria: criteriaSchema.describe("The current user criteria state"),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        nom: z.string(),
        score: z.number(),
        accessibleHandicap: z.enum(["oui", "non"]),
        matchedLabels: z.array(z.string()),
      })
    ),
    topMatch: z
      .object({
        nom: z.string(),
        score: z.number(),
        accessibleHandicap: z.enum(["oui", "non"]),
        matchedLabels: z.array(z.string()),
      })
      .nullable(),
  }),
  execute: async ({ criteria }) => {
    const activeCriteria = Object.entries(criteria)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    const scored = destinations.map((dest) => {
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
    });

    const matches = scored
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      matches,
      topMatch: matches[0] ?? null,
    };
  },
});
