import { z } from 'zod';

import { AUDIENCES } from '../domain/schema';

export const AUDIENCE_FILTERS = ['all', ...AUDIENCES] as const;
export type AudienceFilter = (typeof AUDIENCE_FILTERS)[number];

export const settingsSchema = z.object({
  version: z.literal(1),
  /** Show Japanese translations of instructions, meanings and explanations. */
  japaneseSupport: z.boolean().default(true),
  /** Show "why this activity?" notes and teacher panels (on in the portfolio demo). */
  teachingNotes: z.boolean().default(true),
  /** Play audio at the slower speed by default. */
  slowAudio: z.boolean().default(false),
  voiceURI: z.string().max(300).default(''),
  audience: z.enum(AUDIENCE_FILTERS).default('all'),
  /** Accessibility: show listening transcripts before answering (e.g. for deaf or hard-of-hearing learners). */
  alwaysShowTranscript: z.boolean().default(false),
});

export type Settings = z.output<typeof settingsSchema>;

export function defaultSettings(): Settings {
  return settingsSchema.parse({ version: 1 });
}
