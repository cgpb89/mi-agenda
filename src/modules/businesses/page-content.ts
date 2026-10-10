import { z } from 'zod';

/**
 * Template copy stored in BusinessProfile.pageContent (JSON). Always validated
 * with this schema before writes AND parsed defensively on reads.
 * Rendered as plain text (React escapes it) — never as HTML.
 */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, ' ').trim());

export const pageContentSchema = z.object({
  headline: text(120).optional(),
  intro: text(400).optional(),
  eyebrow: text(80).optional(),
  ctaLabel: text(40).optional(),
  highlights: z
    .array(z.object({ title: text(40), body: text(160) }))
    .max(3)
    .optional(),
  notes: z.array(text(200)).max(5).optional(),
  notesTitle: text(60).optional(),
});

export type PageContent = z.infer<typeof pageContentSchema>;

export function readPageContent(raw: unknown): PageContent {
  const parsed = pageContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
