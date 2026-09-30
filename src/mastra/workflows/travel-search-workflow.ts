import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { destinations } from "../data/destinations";

const searchInputSchema = z.object({
  location: z
    .string()
    .describe(
      "Free-text location or environment the traveler is looking for (e.g. 'montagne', 'Chamonix', 'plage', 'ville'). Matched against the destination name and labels.",
    ),
  maxPrice: z
    .number()
    .optional()
    .describe("Maximum price per person, in euros. When omitted, no price filter is applied."),
});

const travelOfferSchema = z.object({
  nom: z.string(),
  labels: z.array(z.string()),
  accessibleHandicap: z.enum(["oui", "non"]),
  prixParPersonne: z.number(),
});

const searchOutputSchema = z.object({
  message: z.string().describe("Human-readable summary accompanying the results"),
  results: z.array(travelOfferSchema),
});

/** Strips accents for case/accent-insensitive matching (e.g. "montagne" matches "Montagne", "detente" matches "détente"). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const searchDestinationsStep = createStep({
  id: "search-destinations",
  description: "Filters the destination catalog by location keyword and optional max price per person.",
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  execute: async ({ inputData }) => {
    const { location, maxPrice } = inputData;
    const normalizedLocation = normalize(location);

    const results = destinations
      .filter((destination) => {
        const matchesLocation =
          normalize(destination.nom).includes(normalizedLocation) ||
          destination.labels.some((label) => normalize(label).includes(normalizedLocation));
        const matchesPrice = maxPrice === undefined || destination.prixParPersonne <= maxPrice;
        return matchesLocation && matchesPrice;
      })
      .sort((a, b) => a.prixParPersonne - b.prixParPersonne);

    const message =
      results.length > 0
        ? `Voici ${results.length} proposition${results.length > 1 ? "s" : ""} de voyage correspondant à votre recherche.`
        : "Aucune proposition ne correspond à votre recherche. Essayez une autre destination ou un budget plus élevé.";

    return { message, results };
  },
});

export const travelSearchWorkflow = createWorkflow({
  id: "travel-search-workflow",
  description: "Structured search over the travel catalog: takes a location and an optional max price, returns matching offers.",
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
})
  .then(searchDestinationsStep)
  .commit();
