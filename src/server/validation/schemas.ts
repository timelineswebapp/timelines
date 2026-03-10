import { z } from "zod";
import { slugify } from "@/src/lib/utils";

const trimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

export const datePrecisionSchema = z.enum(["year", "month", "day", "approximate"]);
export const importFormatSchema = z.enum(["csv", "json", "text"]);
export const importTypeSchema = z.enum(["timeline_with_events", "events_into_existing_timeline"]);
export const requestStatusSchema = z.enum(["pending", "reviewed", "planned", "rejected", "completed"]);
export const adSlotSchema = z.enum([
  "home_feed_ad",
  "timeline_inline_1",
  "timeline_inline_2",
  "timeline_bottom",
  "search_bottom"
]);
export const adCampaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);

export const sourceSchema = z.object({
  publisher: trimmedString(2, 120),
  url: z.string().trim().url(),
  credibilityScore: z.coerce.number().min(0).max(1)
});

export const embeddedSourceSchema = z.object({
  title: trimmedString(2, 160),
  url: z.string().trim().url(),
  publisher: z.string().trim().max(120).nullish().transform((value) => value || null)
});

export const tagSchema = z.object({
  name: trimmedString(2, 60),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value, ctx) => {
      const computed = slugify(value || "");
      if (!computed) {
        ctx.addIssue({
          code: "custom",
          message: "Slug is required."
        });
        return z.NEVER;
      }

      return computed;
    })
});

export const eventSchema = z.object({
  date: z.string().trim().date(),
  datePrecision: datePrecisionSchema,
  title: trimmedString(3, 160),
  description: trimmedString(10, 2000),
  importance: z.coerce.number().int().min(1).max(5),
  location: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  imageUrl: z.string().trim().url().nullable().optional().transform((value) => value || null),
  timelineId: z.coerce.number().int().positive(),
  eventOrder: z.coerce.number().int().min(1),
  sources: z.array(embeddedSourceSchema).max(20).default([]),
  tagIds: z.array(z.coerce.number().int().positive()).max(20).default([])
});

export const timelineSchema = z.object({
  title: trimmedString(3, 140),
  slug: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value, ctx) => {
      const computed = slugify(value || "");
      if (!computed) {
        ctx.addIssue({
          code: "custom",
          message: "Slug is required."
        });
        return z.NEVER;
      }

      return computed;
    }),
  description: trimmedString(20, 800),
  category: trimmedString(2, 80)
});

export const timelineRequestSchema = z.object({
  query: trimmedString(3, 120),
  language: z.string().trim().min(2).max(20).default("en")
});

export const requestStatusUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: requestStatusSchema
});

export const searchQuerySchema = z.object({
  q: trimmedString(1, 120),
  limit: z.coerce.number().int().min(1).max(20).default(12)
});

export const importRowSchema = z.object({
  date: z.string().trim().min(4).max(10),
  datePrecision: datePrecisionSchema.optional(),
  title: trimmedString(3, 160),
  description: trimmedString(10, 2000),
  importance: z.coerce.number().int().min(1).max(5),
  location: z.string().trim().max(120).nullish(),
  imageUrl: z.string().trim().url().nullish()
});

export const importTimelineSchema = z.object({
  title: trimmedString(3, 140),
  description: trimmedString(20, 800),
  category: trimmedString(2, 80)
});

export const importPreviewSchema = z.object({
  format: importFormatSchema,
  importType: importTypeSchema,
  content: z.string().min(2).max(500000),
  timelineId: z.coerce.number().int().positive().nullable().optional(),
  skipDuplicates: z.coerce.boolean().default(true)
});

export const adCampaignSchema = z.object({
  slot: adSlotSchema,
  campaignName: trimmedString(3, 140),
  advertiser: trimmedString(2, 120),
  creativeImage: z.string().trim().url().nullable().optional().transform((value) => value || null),
  headline: trimmedString(3, 140),
  description: trimmedString(10, 400),
  cta: trimmedString(2, 40),
  targetUrl: z.string().trim().url(),
  startDate: z.string().trim().date(),
  endDate: z.string().trim().date(),
  status: adCampaignStatusSchema
});
