/**
 * Every lesson is played as the same research-informed sequence (present → practise → apply →
 * check). Activities are derived from the lesson's content, so a teacher who adds vocabulary,
 * questions or a reading text automatically gets the matching activities, instructions and
 * "why this activity?" notes without having to design the flow by hand.
 */
import type { Module, Skill } from './schema';

export const ACTIVITY_KINDS = [
  'vocab',
  'match',
  'grammar',
  'practice',
  'listening',
  'reading',
  'quiz',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function isActivityKind(value: string): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value);
}

export interface Bilingual {
  en: string;
  ja: string;
}

export interface ActivityInfo {
  kind: ActivityKind;
  /** Stable progress key: `${moduleId}/${kind}`. */
  key: string;
  moduleId: string;
  title: string;
  titleJa: string;
  skill: Skill;
  /** Completion-only activities (presentation) have no score. */
  scored: boolean;
  instructions: Bilingual;
  /** Why this activity exists: shown to teachers and in demo mode. */
  purpose: string;
  /** Short names of the learning principles behind the design. */
  principles: string[];
  minutes: number;
  itemCount: number;
}

export function activityKey(moduleId: string, kind: ActivityKind): string {
  return `${moduleId}/${kind}`;
}

type Register = 'kids' | 'standard';

function registerFor(module: Module): Register {
  return module.audiences[0] === 'elementary' ? 'kids' : 'standard';
}

const INSTRUCTIONS: Record<ActivityKind, Record<Register, Bilingual>> = {
  vocab: {
    kids: {
      en: 'Tap a card to hear the word. Say it out loud!',
      ja: 'カードをタップして、ことばをきこう。声に出して言ってみよう！',
    },
    standard: {
      en: 'Look at each picture, listen to the word and read the example. Repeat it out loud.',
      ja: '絵を見て音声を聞き、例文を読みましょう。声に出してくり返しましょう。',
    },
  },
  match: {
    kids: {
      en: 'Tap a picture, then tap the word that matches it.',
      ja: '絵をタップしてから、合うことばをタップしよう。',
    },
    standard: {
      en: 'Match each picture with its word. Try to get every pair right the first time.',
      ja: '絵と単語を組み合わせましょう。一回で正解できるようにがんばりましょう。',
    },
  },
  grammar: {
    kids: {
      en: 'Read and listen. Tap the buttons to see how the sentence changes.',
      ja: '読んで、聞いてみよう。ボタンをタップすると、文がかわるよ。',
    },
    standard: {
      en: 'Study the pattern. Use the buttons to see what changes, then check the common mistakes.',
      ja: '文の形を確認しましょう。ボタンで変化を確かめ、よくある間違いもチェックしましょう。',
    },
  },
  practice: {
    kids: {
      en: 'Answer the questions. If you make a mistake, read the hint and try again.',
      ja: '問題にこたえよう。まちがえたら、ヒントを読んでもう一度やってみよう。',
    },
    standard: {
      en: 'Answer each question. A wrong answer gives you a hint first, so you can fix it yourself.',
      ja: '各問題に答えましょう。間違えると、まずヒントが出るので自分で直してみましょう。',
    },
  },
  listening: {
    kids: {
      en: 'Press ▶ to listen. You can listen again or slow it down. Then choose the answer.',
      ja: '▶をおして聞こう。もう一度聞いたり、ゆっくりにしたりできるよ。それから答えをえらぼう。',
    },
    standard: {
      en: 'Press ▶ and listen. Replay or slow down as often as you need, then choose the answer.',
      ja: '▶を押して聞きましょう。何度でも再生・スロー再生できます。それから答えを選びましょう。',
    },
  },
  reading: {
    kids: {
      en: 'Read the story. Tap the underlined words to see what they mean. Then answer the questions.',
      ja: 'お話を読もう。線のあることばをタップすると、意味がわかるよ。それから問題にこたえよう。',
    },
    standard: {
      en: 'Read the text. Tap underlined words for help, then answer the questions.',
      ja: '文章を読みましょう。下線の語をタップすると説明が出ます。それから問題に答えましょう。',
    },
  },
  quiz: {
    kids: {
      en: 'Show what you learned! In the lesson check there are no hints.',
      ja: '学んだことをためそう！レッスンチェックにはヒントがないよ。',
    },
    standard: {
      en: 'Check what you learned. There are no hints here: each question has one try.',
      ja: '学習の成果を確認しましょう。ヒントはなく、各問題は一回だけ答えられます。',
    },
  },
};

const PURPOSES: Record<ActivityKind, { purpose: string; principles: string[] }> = {
  vocab: {
    purpose:
      'Presents each new word with a picture, audio and an example sentence at the same time, so learners connect meaning, sound and spelling without relying on translation. Studied words enter the spaced-review queue.',
    principles: ['Dual coding', 'Multimodal input', 'Meaning before form'],
  },
  match: {
    purpose:
      'Low-stakes retrieval practice straight after presentation. Learners must recall each form–meaning link; first-try accuracy is recorded so the teacher can see which words need re-teaching.',
    principles: ['Retrieval practice', 'Immediate feedback'],
  },
  grammar: {
    purpose:
      'Guided discovery of one grammar pattern: colour-highlighted examples, a sentence switcher that shows exactly what changes, and the mistakes Japanese learners typically make, explained in simple English with Japanese support.',
    principles: ['Noticing', 'Contrastive analysis (L1 Japanese)', 'Scaffolding'],
  },
  practice: {
    purpose:
      'Controlled practice that moves from recognition (multiple choice) to production (fill in the blank, sentence building). A first wrong answer gets a targeted hint so the learner can self-correct; a second shows the model answer and the reason.',
    principles: [
      'Controlled practice',
      'Corrective feedback (prompts before recasts)',
      'Self-correction',
    ],
  },
  listening: {
    purpose:
      'Listening for specific information. The transcript stays hidden until the learner answers, so they really listen; replay and slow speed reduce anxiety, and the number of replays is recorded for the teacher.',
    principles: [
      'Listening for gist and detail',
      'Learner control lowers anxiety',
      'Transcript for noticing',
    ],
  },
  reading: {
    purpose:
      'A short, level-appropriate text with tap-to-see glosses keeps reading comprehensible without a dictionary. Questions check both stated details and simple inference.',
    principles: ['Comprehensible input (i+1)', 'Glossing', 'Detail and inference questions'],
  },
  quiz: {
    purpose:
      'A summative check mixing vocabulary, grammar and listening items from the whole module. The score is compared with the pass mark and feeds the "areas to review" and next-step suggestions.',
    principles: ['Summative assessment', 'Interleaving', 'Data for next steps'],
  },
};

export function activityPurpose(kind: ActivityKind): { purpose: string; principles: string[] } {
  return PURPOSES[kind];
}

/** The playable activities of a lesson, in teaching order. */
export function getActivities(module: Module): ActivityInfo[] {
  const register = registerFor(module);
  const make = (
    kind: ActivityKind,
    title: string,
    titleJa: string,
    skill: Skill,
    scored: boolean,
    itemCount: number,
    minutes: number,
  ): ActivityInfo => ({
    kind,
    key: activityKey(module.id, kind),
    moduleId: module.id,
    title,
    titleJa,
    skill,
    scored,
    instructions: INSTRUCTIONS[kind][register],
    purpose: PURPOSES[kind].purpose,
    principles: PURPOSES[kind].principles,
    minutes,
    itemCount,
  });

  const list: ActivityInfo[] = [];
  const vocabCount = module.vocab.length;
  if (vocabCount > 0) {
    list.push(
      make(
        'vocab',
        'Learn the words',
        'ことばをおぼえよう',
        'vocabulary',
        false,
        vocabCount,
        Math.ceil(vocabCount / 2),
      ),
    );
  }
  if (vocabCount >= 4) {
    list.push(
      make(
        'match',
        'Match the pictures',
        '絵とことばを合わせよう',
        'vocabulary',
        true,
        vocabCount,
        Math.ceil(vocabCount / 3),
      ),
    );
  }
  if (module.grammar) {
    list.push(
      make(
        'grammar',
        `Grammar: ${module.grammar.title}`,
        '文法をたしかめよう',
        'grammar',
        false,
        module.grammar.forms.length,
        4,
      ),
    );
  }
  if (module.practice.length > 0) {
    list.push(
      make(
        'practice',
        'Grammar practice',
        '文法の練習',
        'grammar',
        true,
        module.practice.length,
        Math.ceil(module.practice.length * 0.7),
      ),
    );
  }
  if (module.listening.length > 0) {
    list.push(
      make(
        'listening',
        'Listen and choose',
        '聞いてえらぼう',
        'listening',
        true,
        module.listening.length,
        module.listening.length + 1,
      ),
    );
  }
  if (module.reading) {
    list.push(
      make(
        'reading',
        `Read: ${module.reading.title}`,
        '読んでみよう',
        'reading',
        true,
        module.reading.questions.length,
        5,
      ),
    );
  }
  const quizPool = vocabCount + module.practice.length + module.listening.length;
  if (quizPool >= 4) {
    const count = Math.min(module.quizLength, quizPool);
    list.push(
      make(
        'quiz',
        'Lesson check',
        'レッスンチェック',
        'grammar',
        true,
        count,
        Math.ceil(count * 0.6),
      ),
    );
  }
  return list;
}

export function getActivity(module: Module, kind: ActivityKind): ActivityInfo | undefined {
  return getActivities(module).find((activity) => activity.kind === kind);
}
