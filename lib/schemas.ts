import { z } from "zod";

export const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Coords = z.infer<typeof coordsSchema>;

export const preferenceSchema = z.object({
  roast: z.string().optional(),                      
  tempPref: z.enum(["hot", "iced"]).optional(),
  dairy: z.enum(["normal", "lactoseFree", "none"]).optional(),
  sweetness: z.number().int().min(0).max(5).optional(),
  caffeine: z.enum(["decaf", "regular", "strong"]).optional(),
  flavorNotes: z.array(z.string()).default([]),      
});
export type PreferencesInput = z.infer<typeof preferenceSchema>;

export const feedbackSchema = z.object({
  recommendationId: z.string().min(1),
  coffeeId: z.string().min(1),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  comment: z.string().max(500).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
