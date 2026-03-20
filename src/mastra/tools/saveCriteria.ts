import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { criteriaSchema } from "../data/criteria";

export const saveCriteriaTool = createTool({
  id: "save-criteria",
  description: "Saves the updated user travel criteria after each message.",
  inputSchema: z.object({
    userMessage: z.string().describe("The raw user message"),
    updatedCriteria: criteriaSchema.describe(
      "The FULL updated criteria object after applying the user message to the current state. " +
      "You fill this — merge current criteria with what the user just expressed."
    ),
    isUnclearMessage: z
      .boolean()
      .describe(
        "Set to true if the message has no exploitable meaning for travel preferences (gibberish, off-topic, pure greeting with no preference expressed)"
      ),
  }),
  outputSchema: z.object({
    updatedCriteria: criteriaSchema,
    hasAnyCriteria: z.boolean(),
    isUnclearMessage: z.boolean(),
  }),
  execute: async ({ updatedCriteria, isUnclearMessage }) => {
    const hasAnyCriteria = Object.values(updatedCriteria).some((v) => v === true);
    return {
      updatedCriteria,
      hasAnyCriteria,
      isUnclearMessage,
    };
  },
});
