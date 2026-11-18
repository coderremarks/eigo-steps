/**
 * Content model for Eigo Steps.
 *
 * Every lesson (built-in or written by a teacher) is validated against these schemas before the app
 * uses it. Teacher-authored and imported lessons are untrusted input, so the schemas also enforce
 * length and count limits, strip unknown keys and check cross-field rules (e.g. "the correct answer
 * must be one of the options"). Lesson text is always rendered as plain text by React, never as HTML.
 */
import { z } from 'zod';

export const CEFR_LEVELS = ['Pre-A1', 'A1', 'A2'] as const;
export const AUDIENCES = ['elementary', 'junior-high', 'adult'] as const;
export const SKILLS = ['vocabulary', 'grammar', 'listening', 'reading'] as const;
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'phrase', 'other'] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];
export type Audience = (typeof AUDIENCES)[number];
export type Skill = (typeof SKILLS)[number];

export const AUDIENCE_LABELS: Record<Audience, { en: string; ja: string }> = {
  elementary: { en: 'Elementary school', ja: '小学生' },
  'junior-high': { en: 'Junior high school', ja: '中学生' },
  adult: { en: 'Adult beginners', ja: '大人の初級者' },
};

export const SKILL_LABELS: Record<Skill, { en: string; ja: string }> = {
  vocabulary: { en: 'Vocabulary', ja: '語彙' },
  grammar: { en: 'Grammar', ja: '文法' },
  listening: { en: 'Listening', ja: 'リスニング' },
  reading: { en: 'Reading', ja: 'リーディング' },
};

/** Defensive limits for teacher-authored and imported content. */
export const LIMITS = {
  word: 60,
  label: 80,
  sentence: 220,
  paragraph: 900,
  longText: 1600,
  vocabPerLesson: 24,
  questionsPerSet: 20,
  listeningItems: 12,
  options: 5,
  tagsPerItem: 5,
  storedLessons: 60,
  importBytes: 1_000_000,
} as const;

// ---------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------

const required = (max: number, label = 'This field') =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optional = (max: number) => z.string().trim().max(max).default('');

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and hyphens only.');

const PICTOGRAPH = /\p{Extended_Pictographic}/u;
export const pictureSchema = z
  .string()
  .trim()
  .min(1, 'Choose a picture.')
  .max(32)
  .refine((value) => PICTOGRAPH.test(value), 'Choose an emoji picture.');

/** Text where [square brackets] highlight the target language. Brackets must be paired. */
export function hasBalancedBrackets(value: string): boolean {
  let open = false;
  for (const char of value) {
    if (char === '[') {
      if (open) return false;
      open = true;
    } else if (char === ']') {
      if (!open) return false;
      open = false;
    }
  }
  return !open;
}

const highlighted = (max: number, label?: string) =>
  required(max, label).refine(hasBalancedBrackets, 'Use [ and ] in pairs to highlight words.');

const tagsSchema = z
  .array(z.string().trim().min(1).max(40).regex(SLUG_PATTERN, 'Tags use lowercase-and-hyphens.'))
  .max(LIMITS.tagsPerItem)
  .default([]);

const bilingual = (max: number) =>
  z.object({ en: required(max, 'English text'), ja: optional(max) });

const optionSchema = z
  .union([
    required(LIMITS.sentence, 'Option'),
    z.object({ text: required(LIMITS.sentence, 'Option'), picture: pictureSchema.optional() }),
  ])
  .transform((option) => (typeof option === 'string' ? { text: option } : option));

export type ChoiceOption = z.output<typeof optionSchema>;

function answerInRange(value: { answer: number; options: unknown[] }): boolean {
  return value.answer < value.options.length;
}

function uniqueOptionTexts(value: { options: ChoiceOption[] }): boolean {
  const texts = value.options.map((option) => option.text.toLowerCase());
  return new Set(texts).size === texts.length;
}

function picturesForPictureOnly(value: { pictureOnly: boolean; options: ChoiceOption[] }) {
  return !value.pictureOnly || value.options.every((option) => Boolean(option.picture));
}

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------

export const vocabItemSchema = z.object({
  id: slugSchema,
  word: required(LIMITS.word, 'Word'),
  ja: optional(LIMITS.label),
  picture: pictureSchema,
  partOfSpeech: z.enum(PARTS_OF_SPEECH).default('noun'),
  example: highlighted(LIMITS.sentence, 'Example sentence'),
  exampleJa: optional(LIMITS.sentence),
  /** Short teaching note shown on the card, e.g. "go → went (irregular)". */
  note: optional(LIMITS.label),
});
export type VocabItem = z.output<typeof vocabItemSchema>;

// ---------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------

export const mcqSchema = z
  .object({
    kind: z.literal('mcq'),
    id: slugSchema,
    prompt: required(LIMITS.sentence, 'Question'),
    promptJa: optional(LIMITS.sentence),
    picture: pictureSchema.optional(),
    options: z.array(optionSchema).min(2, 'Add at least 2 options.').max(LIMITS.options),
    answer: z.number().int().min(0),
    explanation: required(LIMITS.paragraph, 'Explanation'),
    /** Corrective feedback for each option (shown when that option is chosen by mistake). */
    optionFeedback: z.array(z.string().trim().max(LIMITS.sentence)).max(LIMITS.options).default([]),
    shuffle: z.boolean().default(true),
    pictureOnly: z.boolean().default(false),
    tags: tagsSchema,
  })
  .refine(answerInRange, {
    message: 'The correct answer must be one of the options.',
    path: ['answer'],
  })
  .refine(uniqueOptionTexts, { message: 'Options must all be different.', path: ['options'] })
  .refine(picturesForPictureOnly, {
    message: 'Picture-only questions need a picture for every option.',
    path: ['options'],
  });

export const BLANK = '___';

export const fillSchema = z
  .object({
    kind: z.literal('fill'),
    id: slugSchema,
    sentence: required(LIMITS.sentence, 'Sentence').refine(
      (value) => value.split(BLANK).length === 2,
      'Write ___ (three underscores) exactly once where the answer goes.',
    ),
    sentenceJa: optional(LIMITS.sentence),
    picture: pictureSchema.optional(),
    answers: z.array(required(LIMITS.word, 'Answer')).min(1, 'Add the correct answer.').max(5),
    /** Word-bank choices. Empty means the learner types the answer. */
    choices: z.array(required(LIMITS.word, 'Choice')).max(6).default([]),
    hint: optional(LIMITS.sentence),
    explanation: required(LIMITS.paragraph, 'Explanation'),
    commonErrors: z
      .array(
        z.object({
          answer: required(LIMITS.word, 'Wrong answer'),
          feedback: required(LIMITS.sentence, 'Feedback'),
        }),
      )
      .max(6)
      .default([]),
    tags: tagsSchema,
  })
  .refine((q) => q.choices.length === 0 || q.choices.length >= 2, {
    message: 'A word bank needs at least 2 choices.',
    path: ['choices'],
  })
  .refine(
    (q) =>
      q.choices.length === 0 ||
      q.choices.some((choice) => q.answers.some((answer) => answer === choice)),
    { message: 'One of the choices must be a correct answer.', path: ['choices'] },
  );

export const buildSchema = z
  .object({
    kind: z.literal('build'),
    id: slugSchema,
    /** What to build, e.g. the Japanese meaning or an instruction. */
    prompt: required(LIMITS.sentence, 'Prompt'),
    picture: pictureSchema.optional(),
    answer: required(LIMITS.sentence, 'Answer sentence'),
    /** Other correct orders using the same words. */
    alternatives: z.array(required(LIMITS.sentence, 'Alternative')).max(4).default([]),
    /** Extra word tiles that do not belong in the sentence. */
    distractors: z.array(required(LIMITS.word, 'Extra word')).max(4).default([]),
    explanation: required(LIMITS.paragraph, 'Explanation'),
    tags: tagsSchema,
  })
  .refine(
    (q) => {
      const count = q.answer.split(/\s+/).length;
      return count >= 2 && count <= 14;
    },
    { message: 'The answer sentence needs 2 to 14 words.', path: ['answer'] },
  );

export const questionSchema = z.discriminatedUnion('kind', [mcqSchema, fillSchema, buildSchema]);

export type McqQuestion = z.output<typeof mcqSchema>;
export type FillQuestion = z.output<typeof fillSchema>;
export type BuildQuestion = z.output<typeof buildSchema>;
export type Question = z.output<typeof questionSchema>;

// ---------------------------------------------------------------------------------------------
// Listening, reading, grammar
// ---------------------------------------------------------------------------------------------

export const scriptLineSchema = z.object({
  speaker: z.string().trim().max(20).default(''),
  text: required(LIMITS.sentence, 'Script line'),
});
export type ScriptLine = z.output<typeof scriptLineSchema>;

export const listeningItemSchema = z
  .object({
    id: slugSchema,
    script: z.array(scriptLineSchema).min(1, 'Add at least one line.').max(8),
    question: required(LIMITS.sentence, 'Question'),
    questionJa: optional(LIMITS.sentence),
    options: z.array(optionSchema).min(2, 'Add at least 2 options.').max(4),
    answer: z.number().int().min(0),
    explanation: required(LIMITS.paragraph, 'Explanation'),
    optionFeedback: z.array(z.string().trim().max(LIMITS.sentence)).max(4).default([]),
    shuffle: z.boolean().default(true),
    pictureOnly: z.boolean().default(false),
    tags: tagsSchema,
  })
  .refine(answerInRange, {
    message: 'The correct answer must be one of the options.',
    path: ['answer'],
  })
  .refine(uniqueOptionTexts, { message: 'Options must all be different.', path: ['options'] })
  .refine(picturesForPictureOnly, {
    message: 'Picture-only questions need a picture for every option.',
    path: ['options'],
  });
export type ListeningItem = z.output<typeof listeningItemSchema>;

export const glossSchema = z.object({
  term: required(LIMITS.word, 'Term'),
  meaning: required(LIMITS.sentence, 'Meaning'),
  ja: optional(LIMITS.label),
});
export type Gloss = z.output<typeof glossSchema>;

export const readingSchema = z.object({
  title: required(LIMITS.label, 'Reading title'),
  picture: pictureSchema.optional(),
  paragraphs: z.array(required(LIMITS.paragraph, 'Paragraph')).min(1).max(8),
  glossary: z.array(glossSchema).max(16).default([]),
  questions: z.array(mcqSchema).min(1, 'Add at least one reading question.').max(8),
});
export type Reading = z.output<typeof readingSchema>;

export const grammarSchema = z.object({
  title: required(LIMITS.label, 'Grammar title'),
  pattern: required(LIMITS.sentence, 'Pattern'),
  explanation: bilingual(LIMITS.longText),
  forms: z
    .array(
      z.object({
        label: required(40, 'Tab label'),
        labelJa: optional(40),
        examples: z
          .array(
            z.object({
              text: highlighted(LIMITS.sentence, 'Example'),
              ja: optional(LIMITS.sentence),
            }),
          )
          .min(1)
          .max(6),
      }),
    )
    .min(1)
    .max(4),
  switcher: z
    .object({
      prompt: required(LIMITS.sentence, 'Switcher prompt'),
      promptJa: optional(LIMITS.sentence),
      options: z
        .array(
          z.object({
            label: required(40, 'Switcher option'),
            picture: pictureSchema.optional(),
            sentence: highlighted(LIMITS.sentence, 'Switcher sentence'),
            note: optional(LIMITS.sentence),
          }),
        )
        .min(2)
        .max(8),
    })
    .optional(),
  mistakes: z
    .array(
      z.object({
        wrong: required(LIMITS.sentence, 'Mistake'),
        right: required(LIMITS.sentence, 'Correction'),
        why: required(LIMITS.sentence, 'Reason'),
        whyJa: optional(LIMITS.sentence),
      }),
    )
    .max(6)
    .default([]),
});
export type GrammarPoint = z.output<typeof grammarSchema>;

// ---------------------------------------------------------------------------------------------
// Lesson module
// ---------------------------------------------------------------------------------------------

export const moduleSchema = z
  .object({
    id: slugSchema,
    title: required(60, 'Title'),
    titleJa: optional(60),
    summary: required(300, 'Summary'),
    level: z.enum(CEFR_LEVELS),
    /** Finer CEFR-J band (e.g. "A1.2"), widely used in Japanese schools. */
    cefrJ: optional(20),
    audiences: z.array(z.enum(AUDIENCES)).min(1, 'Choose at least one group of learners.').max(3),
    topic: required(40, 'Topic'),
    cover: pictureSchema,
    minutes: z.number().int().min(5).max(120),
    objectives: z
      .array(required(LIMITS.sentence, 'Objective'))
      .min(1, 'Add a learning objective.')
      .max(6),
    successCriteria: z
      .array(required(LIMITS.sentence, 'Success criterion'))
      .min(1, 'Add a success criterion.')
      .max(6),
    studentInstructions: bilingual(LIMITS.paragraph),
    teacherInstructions: z.object({
      overview: required(LIMITS.paragraph, 'Teacher overview'),
      steps: z.array(required(300, 'Lesson step')).min(1, 'Add at least one lesson step.').max(10),
      differentiation: z.array(required(300, 'Differentiation note')).max(6).default([]),
      commonErrors: z.array(required(300, 'Common error')).max(8).default([]),
    }),
    /** How learners receive feedback in this module. */
    feedback: required(LIMITS.paragraph, 'Feedback approach'),
    assessment: z.object({
      formative: required(LIMITS.paragraph, 'Formative assessment'),
      summative: required(LIMITS.paragraph, 'Summative assessment'),
      passMark: z.number().int().min(50).max(100),
    }),
    vocab: z.array(vocabItemSchema).max(LIMITS.vocabPerLesson).default([]),
    grammar: grammarSchema.optional(),
    practice: z.array(questionSchema).max(LIMITS.questionsPerSet).default([]),
    listening: z.array(listeningItemSchema).max(LIMITS.listeningItems).default([]),
    reading: readingSchema.optional(),
    quizLength: z.number().int().min(4).max(20).default(8),
    source: z.enum(['built-in', 'custom']).default('custom'),
    updatedAt: z.string().max(40).optional(),
  })
  .superRefine((lesson, ctx) => {
    const hasContent =
      lesson.vocab.length > 0 ||
      lesson.grammar !== undefined ||
      lesson.practice.length > 0 ||
      lesson.listening.length > 0 ||
      lesson.reading !== undefined;
    if (!hasContent) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add some content: vocabulary, grammar, questions, listening or reading.',
        path: ['vocab'],
      });
    }

    const vocabIds = new Set<string>();
    lesson.vocab.forEach((item, index) => {
      if (vocabIds.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate word id "${item.id}".`,
          path: ['vocab', index, 'id'],
        });
      }
      vocabIds.add(item.id);
    });

    const questionIds = new Set<string>();
    const checkId = (id: string, path: (string | number)[]) => {
      if (questionIds.has(id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate question id "${id}".`, path });
      }
      questionIds.add(id);
    };
    lesson.practice.forEach((q, index) => checkId(q.id, ['practice', index, 'id']));
    lesson.listening.forEach((q, index) => checkId(q.id, ['listening', index, 'id']));
    lesson.reading?.questions.forEach((q, index) =>
      checkId(q.id, ['reading', 'questions', index, 'id']),
    );
  });

export type Module = z.output<typeof moduleSchema>;
export type ModuleInput = z.input<typeof moduleSchema>;

/** Identity helper that type-checks built-in lesson data against the schema's input type. */
export function defineModule(input: ModuleInput): ModuleInput {
  return input;
}

const PATH_LABELS: Record<string, string> = {
  vocab: 'Word',
  practice: 'Question',
  listening: 'Listening item',
  questions: 'Question',
  glossary: 'Word help',
  options: 'Option',
  forms: 'Example group',
  examples: 'Example',
  mistakes: 'Mistake',
  objectives: 'Objective',
  successCriteria: 'Success criterion',
  steps: 'Step',
  script: 'Line',
  paragraphs: 'Paragraph',
};

/** Turns a Zod path like ["vocab", 2, "example"] into "Word 3 › example". */
export function describePath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  path.forEach((segment, index) => {
    if (typeof segment === 'number') return;
    const label = PATH_LABELS[String(segment)];
    const next = path[index + 1];
    if (label && typeof next === 'number') parts.push(`${label} ${next + 1}`);
    else parts.push(String(segment));
  });
  return parts.join(' › ');
}

/** Turns Zod issues into short, field-labelled messages for teachers. */
export function describeIssues(error: z.ZodError, max = 8): string[] {
  return error.issues.slice(0, max).map((issue) => {
    const where = issue.path.length > 0 ? `${describePath(issue.path)}: ` : '';
    return `${where}${issue.message}`;
  });
}
