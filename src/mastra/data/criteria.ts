import { z } from "zod";

export const criteriaSchema = z.object({
  plage: z.boolean().nullable().optional(),
  montagne: z.boolean().nullable().optional(),
  ville: z.boolean().nullable().optional(),
  sport: z.boolean().nullable().optional(),
  detente: z.boolean().nullable().optional(),
  acces_handicap: z.boolean().nullable().optional(),
});

export type Criteria = z.infer<typeof criteriaSchema>;

export const emptyCriteria: Criteria = {
  plage: null,
  montagne: null,
  ville: null,
  sport: null,
  detente: null,
  acces_handicap: null,
};
