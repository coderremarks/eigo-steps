import type { ItemAnswer } from '../../domain/progress';

/** What an activity player reports when the learner finishes. */
export interface ActivityOutcome {
  /** 0–100, or null for completion-only activities. */
  score: number | null;
  correct: number;
  total: number;
  answers: ItemAnswer[];
  learnedVocab?: string[];
}
