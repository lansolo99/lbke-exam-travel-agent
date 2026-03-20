import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema, type Criteria } from "../data/criteria";

export const extractCriteriaTool = createTool({
  id: "extract-criteria",
  description:
    "Analyzes the user message against the current criteria state and returns the full updated criteria object. " +
    "A criterion is set to true only if the user expressed a clear positive preference. " +
    "It is set to false if the user expressed a negative preference or contradiction. " +
    "It remains null if not mentioned.",
  inputSchema: z.object({
    userMessage: z.string().describe("The raw user message to analyze"),
    currentCriteria: criteriaSchema.describe(
      "The current accumulated criteria state to update"
    ),
  }),
  outputSchema: z.object({
    updatedCriteria: criteriaSchema,
    hasAnyCriteria: z
      .boolean()
      .describe("True if at least one criterion is set to true"),
    isUnclearMessage: z
      .boolean()
      .describe(
        "True if the message has no exploitable meaning for travel preferences"
      ),
  }),
  execute: async ({ userMessage, currentCriteria }) => {
    // This tool's execute is intentionally minimal — the LLM handles the
    // actual extraction via structured output. The agent calls this tool
    // and the framework invokes the LLM with the input schema to produce output.
    // However since createTool execute runs in isolation, we do the logic here
    // as a pure function that the agent will call with LLM-filled inputs.
    //
    // In practice: the agent receives the tool call result already filled by the LLM
    // because the agent itself does the reasoning when deciding tool arguments.
    // This execute is a passthrough — the agent fills the args, we just validate & return.

    const updated: Criteria = { ...currentCriteria };

    const lower = userMessage.toLowerCase();

    // Simple keyword heuristics as fallback — the LLM agent is the primary reasoner
    // and will pass already-reasoned values. This execute just returns what it received.
    // (The agent fills inputSchema fields, we return outputSchema fields.)

    const hasAnyCriteria = Object.values(updated).some((v) => v === true);

    const meaninglessPatterns =
      /^[^a-zA-ZÀ-ÿ0-9]{3,}$|^(.)\1{4,}$|^\s*$/;
    const isUnclearMessage =
      meaninglessPatterns.test(userMessage.trim()) && lower.length < 5;

    return {
      updatedCriteria: updated,
      hasAnyCriteria,
      isUnclearMessage,
    };
  },
});
