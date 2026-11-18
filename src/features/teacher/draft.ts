/**
 * The lesson editor works on a "draft": the lesson in a form-friendly shape (lists as lines of
 * text, comma-separated answers). These pure functions convert between drafts and lessons, so the
 * editor stays simple and the conversion is unit-tested (every built-in lesson round-trips without
 * loss). Validation always happens on the real lesson schema when saving.
 */
import type {
  Audience,
  CefrLevel,
  GrammarPoint,
  Module,
  ModuleInput,
  Question,
} from '../../domain/schema';
import { slugify, uniqueId } from '../../domain/text';

export interface VocabDraft {
  key: string;
  id: string;
  word: string;
  ja: string;
  picture: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'phrase' | 'other';
  example: string;
  exampleJa: string;
  note: string;
}

export interface OptionDraft {
  text: string;
  picture: string;
}

export interface McqDraft {
  key: string;
  kind: 'mcq';
  id: string;
  prompt: string;
  promptJa: string;
  picture: string;
  options: OptionDraft[];
  answer: number;
  explanation: string;
  optionFeedback: string[];
  shuffle: boolean;
  pictureOnly: boolean;
  tags: string;
}

export interface FillDraft {
  key: string;
  kind: 'fill';
  id: string;
  sentence: string;
  sentenceJa: string;
  picture: string;
  answers: string;
  choices: string;
  hint: string;
  explanation: string;
  /** One per line: wrong answer | feedback */
  commonErrors: string;
  tags: string;
}

export interface BuildDraft {
  key: string;
  kind: 'build';
  id: string;
  prompt: string;
  picture: string;
  answer: string;
  alternatives: string;
  distractors: string;
  explanation: string;
  tags: string;
}

export type QuestionDraft = McqDraft | FillDraft | BuildDraft;

export interface ListeningDraft {
  key: string;
  id: string;
  script: string;
  question: string;
  questionJa: string;
  options: OptionDraft[];
  answer: number;
  explanation: string;
  optionFeedback: string[];
  shuffle: boolean;
  pictureOnly: boolean;
  tags: string;
}

export interface Draft {
  id: string;
  isNew: boolean;
  title: string;
  titleJa: string;
  summary: string;
  level: CefrLevel;
  cefrJ: string;
  audiences: Audience[];
  topic: string;
  cover: string;
  minutes: number;
  objectives: string;
  successCriteria: string;
  studentEn: string;
  studentJa: string;
  overview: string;
  steps: string;
  differentiation: string;
  commonErrors: string;
  feedback: string;
  formative: string;
  summative: string;
  passMark: number;
  vocab: VocabDraft[];
  grammarEnabled: boolean;
  grammarTitle: string;
  grammarPattern: string;
  grammarEn: string;
  grammarJa: string;
  /** Examples, one per line ("English | Japanese"); a line "# Label | ラベル" starts a new tab. */
  grammarExamples: string;
  grammarMistakes: string;
  /** Interactive switcher from a built-in lesson, kept unchanged when duplicating. */
  grammarSwitcher?: GrammarPoint['switcher'];
  practice: QuestionDraft[];
  listening: ListeningDraft[];
  readingEnabled: boolean;
  readingTitle: string;
  readingPicture: string;
  readingText: string;
  glossary: string;
  readingQuestions: McqDraft[];
  quizLength: number;
}

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `k${Date.now().toString(36)}${counter}`;
}

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const list = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const pipe = (line: string) => line.split('|').map((part) => part.trim());
const joinLines = (items: readonly string[]) => items.join('\n');
const tags = (value: string) => list(value).map((tag) => slugify(tag));
const option = (text = '', picture = ''): OptionDraft => ({ text, picture });

export function emptyVocab(): VocabDraft {
  return {
    key: newKey(),
    id: '',
    word: '',
    ja: '',
    picture: '',
    partOfSpeech: 'noun',
    example: '',
    exampleJa: '',
    note: '',
  };
}

export function emptyMcq(): McqDraft {
  return {
    key: newKey(),
    kind: 'mcq',
    id: '',
    prompt: '',
    promptJa: '',
    picture: '',
    options: [option(), option(), option()],
    answer: 0,
    explanation: '',
    optionFeedback: ['', '', ''],
    shuffle: true,
    pictureOnly: false,
    tags: '',
  };
}

export function emptyQuestion(kind: QuestionDraft['kind']): QuestionDraft {
  switch (kind) {
    case 'mcq':
      return emptyMcq();
    case 'fill':
      return {
        key: newKey(),
        kind,
        id: '',
        sentence: '',
        sentenceJa: '',
        picture: '',
        answers: '',
        choices: '',
        hint: '',
        explanation: '',
        commonErrors: '',
        tags: '',
      };
    case 'build':
      return {
        key: newKey(),
        kind,
        id: '',
        prompt: '',
        picture: '',
        answer: '',
        alternatives: '',
        distractors: '',
        explanation: '',
        tags: '',
      };
  }
}

export function emptyListening(): ListeningDraft {
  return {
    key: newKey(),
    id: '',
    script: '',
    question: '',
    questionJa: '',
    options: [option(), option(), option()],
    answer: 0,
    explanation: '',
    optionFeedback: ['', '', ''],
    shuffle: true,
    pictureOnly: false,
    tags: '',
  };
}

export function emptyDraft(): Draft {
  return {
    id: '',
    isNew: true,
    title: '',
    titleJa: '',
    summary: '',
    level: 'A1',
    cefrJ: '',
    audiences: ['junior-high'],
    topic: '',
    cover: '📘',
    minutes: 20,
    objectives: '',
    successCriteria: 'Scores 70% or more on the lesson check.',
    studentEn: '',
    studentJa: '',
    overview: '',
    steps: '',
    differentiation: '',
    commonErrors: '',
    feedback:
      'Learners get a targeted hint after a first mistake and the model answer with an explanation after a second, so they can self-correct before being told.',
    formative:
      'Check first-try accuracy and focus areas in the class overview; re-teach anything below 70%.',
    summative: 'Lesson check with one try per question.',
    passMark: 70,
    vocab: [emptyVocab(), emptyVocab(), emptyVocab(), emptyVocab()],
    grammarEnabled: false,
    grammarTitle: '',
    grammarPattern: '',
    grammarEn: '',
    grammarJa: '',
    grammarExamples: '',
    grammarMistakes: '',
    practice: [],
    listening: [],
    readingEnabled: false,
    readingTitle: '',
    readingPicture: '',
    readingText: '',
    glossary: '',
    readingQuestions: [],
    quizLength: 8,
  };
}

function mcqToDraft(question: Extract<Question, { kind: 'mcq' }>): McqDraft {
  return {
    key: newKey(),
    kind: 'mcq',
    id: question.id,
    prompt: question.prompt,
    promptJa: question.promptJa,
    picture: question.picture ?? '',
    options: question.options.map((item) => option(item.text, item.picture ?? '')),
    answer: question.answer,
    explanation: question.explanation,
    optionFeedback: question.options.map((_, index) => question.optionFeedback[index] ?? ''),
    shuffle: question.shuffle,
    pictureOnly: question.pictureOnly,
    tags: question.tags.join(', '),
  };
}

function questionToDraft(question: Question): QuestionDraft {
  switch (question.kind) {
    case 'mcq':
      return mcqToDraft(question);
    case 'fill':
      return {
        key: newKey(),
        kind: 'fill',
        id: question.id,
        sentence: question.sentence,
        sentenceJa: question.sentenceJa,
        picture: question.picture ?? '',
        answers: question.answers.join(', '),
        choices: question.choices.join(', '),
        hint: question.hint,
        explanation: question.explanation,
        commonErrors: joinLines(
          question.commonErrors.map((error) => `${error.answer} | ${error.feedback}`),
        ),
        tags: question.tags.join(', '),
      };
    case 'build':
      return {
        key: newKey(),
        kind: 'build',
        id: question.id,
        prompt: question.prompt,
        picture: question.picture ?? '',
        answer: question.answer,
        alternatives: joinLines(question.alternatives),
        distractors: question.distractors.join(', '),
        explanation: question.explanation,
        tags: question.tags.join(', '),
      };
  }
}

function grammarExamplesText(grammar: GrammarPoint): string {
  const blocks = grammar.forms.map((form) => {
    const header = `# ${form.label}${form.labelJa ? ` | ${form.labelJa}` : ''}`;
    const examples = form.examples.map((example) =>
      example.ja ? `${example.text} | ${example.ja}` : example.text,
    );
    return [header, ...examples].join('\n');
  });
  return blocks.join('\n');
}

/** Lesson → editable draft. With `copyId`, the draft becomes a new lesson (duplicate). */
export function moduleToDraft(module: Module, copyId?: string): Draft {
  return {
    id: copyId ?? module.id,
    isNew: copyId !== undefined,
    title: copyId ? `${module.title} (copy)`.slice(0, 60) : module.title,
    titleJa: module.titleJa,
    summary: module.summary,
    level: module.level,
    cefrJ: module.cefrJ,
    audiences: [...module.audiences],
    topic: module.topic,
    cover: module.cover,
    minutes: module.minutes,
    objectives: joinLines(module.objectives),
    successCriteria: joinLines(module.successCriteria),
    studentEn: module.studentInstructions.en,
    studentJa: module.studentInstructions.ja,
    overview: module.teacherInstructions.overview,
    steps: joinLines(module.teacherInstructions.steps),
    differentiation: joinLines(module.teacherInstructions.differentiation),
    commonErrors: joinLines(module.teacherInstructions.commonErrors),
    feedback: module.feedback,
    formative: module.assessment.formative,
    summative: module.assessment.summative,
    passMark: module.assessment.passMark,
    vocab: module.vocab.map((item) => ({ key: newKey(), ...item })),
    grammarEnabled: module.grammar !== undefined,
    grammarTitle: module.grammar?.title ?? '',
    grammarPattern: module.grammar?.pattern ?? '',
    grammarEn: module.grammar?.explanation.en ?? '',
    grammarJa: module.grammar?.explanation.ja ?? '',
    grammarExamples: module.grammar ? grammarExamplesText(module.grammar) : '',
    grammarMistakes: joinLines(
      module.grammar?.mistakes.map((mistake) =>
        [mistake.wrong, mistake.right, mistake.why, mistake.whyJa].filter(Boolean).join(' | '),
      ) ?? [],
    ),
    grammarSwitcher: module.grammar?.switcher,
    practice: module.practice.map(questionToDraft),
    listening: module.listening.map((item) => ({
      key: newKey(),
      id: item.id,
      script: joinLines(
        item.script.map((line) => (line.speaker ? `${line.speaker}: ${line.text}` : line.text)),
      ),
      question: item.question,
      questionJa: item.questionJa,
      options: item.options.map((entry) => option(entry.text, entry.picture ?? '')),
      answer: item.answer,
      explanation: item.explanation,
      optionFeedback: item.options.map((_, index) => item.optionFeedback[index] ?? ''),
      shuffle: item.shuffle,
      pictureOnly: item.pictureOnly,
      tags: item.tags.join(', '),
    })),
    readingEnabled: module.reading !== undefined,
    readingTitle: module.reading?.title ?? '',
    readingPicture: module.reading?.picture ?? '',
    readingText: (module.reading?.paragraphs ?? []).join('\n\n'),
    glossary: joinLines(
      (module.reading?.glossary ?? []).map((entry) =>
        [entry.term, entry.meaning, entry.ja].filter(Boolean).join(' | '),
      ),
    ),
    readingQuestions: (module.reading?.questions ?? []).map(mcqToDraft),
    quizLength: module.quizLength,
  };
}

function ids(
  prefix: string,
  items: readonly { id: string }[],
  label: (index: number) => string,
): string[] {
  const taken = new Set<string>();
  return items.map((item, index) => {
    const id = uniqueId(item.id || slugify(label(index), `${prefix}${index + 1}`), taken);
    taken.add(id);
    return id;
  });
}

/** Keeps only filled-in options and re-maps the answer index (an empty answer fails validation). */
function choiceInput(options: readonly OptionDraft[], answer: number, feedback: readonly string[]) {
  const filled = options
    .map((entry, index) => ({ ...entry, text: entry.text.trim(), index }))
    .filter((entry) => entry.text);
  const answerIndex = filled.findIndex((entry) => entry.index === answer);
  const optionFeedback = filled.map((entry) => feedback[entry.index]?.trim() ?? '');
  return {
    options: filled.map((entry) =>
      entry.picture.trim()
        ? { text: entry.text, picture: entry.picture.trim() }
        : { text: entry.text },
    ),
    answer: answerIndex === -1 ? options.length + 1 : answerIndex,
    optionFeedback: optionFeedback.some(Boolean) ? optionFeedback : [],
  };
}

function mcqInput(draft: McqDraft, id: string) {
  return {
    kind: 'mcq' as const,
    id,
    prompt: draft.prompt,
    promptJa: draft.promptJa,
    ...(draft.picture.trim() ? { picture: draft.picture.trim() } : {}),
    ...choiceInput(draft.options, draft.answer, draft.optionFeedback),
    explanation: draft.explanation,
    shuffle: draft.shuffle,
    pictureOnly: draft.pictureOnly,
    tags: tags(draft.tags),
  };
}

function grammarForms(text: string) {
  const forms: { label: string; labelJa: string; examples: { text: string; ja: string }[] }[] = [];
  for (const line of lines(text)) {
    if (line.startsWith('#')) {
      const [label = '', labelJa = ''] = pipe(line.replace(/^#+\s*/, ''));
      forms.push({ label: label || 'Examples', labelJa, examples: [] });
      continue;
    }
    if (forms.length === 0) forms.push({ label: 'Examples', labelJa: '例文', examples: [] });
    const current = forms[forms.length - 1]!;
    if (current.examples.length >= 6) {
      forms.push({ label: `${current.label} (2)`, labelJa: current.labelJa, examples: [] });
    }
    const [example = '', ja = ''] = pipe(line);
    forms[forms.length - 1]!.examples.push({ text: example, ja });
  }
  return forms.filter((form) => form.examples.length > 0);
}

/** Draft → lesson input (validated by the store when saving). */
export function draftToInput(draft: Draft, takenIds: ReadonlySet<string>): ModuleInput {
  const id = draft.isNew
    ? uniqueId(slugify(draft.id || draft.title, 'my-lesson'), takenIds)
    : draft.id;
  const vocabIds = ids('word', draft.vocab, (index) => draft.vocab[index]?.word ?? '');
  const practiceIds = ids('q', draft.practice, (index) => `q${index + 1}`);
  const listeningIds = ids('listening', draft.listening, (index) => `listening-${index + 1}`);
  const readingIds = ids('reading', draft.readingQuestions, (index) => `reading-${index + 1}`);

  return {
    id,
    title: draft.title,
    titleJa: draft.titleJa,
    summary: draft.summary,
    level: draft.level,
    cefrJ: draft.cefrJ,
    audiences: draft.audiences,
    topic: draft.topic || draft.title,
    cover: draft.cover,
    minutes: Number(draft.minutes) || 20,
    objectives: lines(draft.objectives),
    successCriteria: lines(draft.successCriteria),
    studentInstructions: { en: draft.studentEn, ja: draft.studentJa },
    teacherInstructions: {
      overview: draft.overview,
      steps: lines(draft.steps),
      differentiation: lines(draft.differentiation),
      commonErrors: lines(draft.commonErrors),
    },
    feedback: draft.feedback,
    assessment: {
      formative: draft.formative,
      summative: draft.summative,
      passMark: Number(draft.passMark) || 70,
    },
    vocab: draft.vocab
      .map((item, index) => ({ item, id: vocabIds[index] ?? `word${index + 1}` }))
      .filter(({ item }) => item.word.trim() || item.example.trim() || item.picture.trim())
      .map(({ item, id: vocabId }) => ({
        id: vocabId,
        word: item.word,
        ja: item.ja,
        picture: item.picture,
        partOfSpeech: item.partOfSpeech,
        example: item.example,
        exampleJa: item.exampleJa,
        note: item.note,
      })),
    ...(draft.grammarEnabled
      ? {
          grammar: {
            title: draft.grammarTitle,
            pattern: draft.grammarPattern,
            explanation: { en: draft.grammarEn, ja: draft.grammarJa },
            forms: grammarForms(draft.grammarExamples),
            ...(draft.grammarSwitcher ? { switcher: draft.grammarSwitcher } : {}),
            mistakes: lines(draft.grammarMistakes).map((line) => {
              const [wrong = '', right = '', why = '', whyJa = ''] = pipe(line);
              return { wrong, right, why, whyJa };
            }),
          },
        }
      : {}),
    practice: draft.practice.map((question, index) => {
      const qid = practiceIds[index] ?? `q${index + 1}`;
      switch (question.kind) {
        case 'mcq':
          return mcqInput(question, qid);
        case 'fill':
          return {
            kind: 'fill' as const,
            id: qid,
            sentence: question.sentence,
            sentenceJa: question.sentenceJa,
            ...(question.picture.trim() ? { picture: question.picture.trim() } : {}),
            answers: list(question.answers),
            choices: list(question.choices),
            hint: question.hint,
            explanation: question.explanation,
            commonErrors: lines(question.commonErrors).map((line) => {
              const [answer = '', feedback = ''] = pipe(line);
              return { answer, feedback };
            }),
            tags: tags(question.tags),
          };
        case 'build':
          return {
            kind: 'build' as const,
            id: qid,
            prompt: question.prompt,
            ...(question.picture.trim() ? { picture: question.picture.trim() } : {}),
            answer: question.answer,
            alternatives: lines(question.alternatives),
            distractors: list(question.distractors),
            explanation: question.explanation,
            tags: tags(question.tags),
          };
      }
    }),
    listening: draft.listening.map((item, index) => ({
      id: listeningIds[index] ?? `listening-${index + 1}`,
      script: lines(item.script).map((line) => {
        const match = /^([^:]{1,20}):\s*(.+)$/.exec(line);
        return match
          ? { speaker: match[1]?.trim() ?? '', text: match[2]?.trim() ?? '' }
          : { speaker: '', text: line };
      }),
      question: item.question,
      questionJa: item.questionJa,
      ...choiceInput(item.options, item.answer, item.optionFeedback),
      explanation: item.explanation,
      shuffle: item.shuffle,
      pictureOnly: item.pictureOnly,
      tags: tags(item.tags),
    })),
    ...(draft.readingEnabled
      ? {
          reading: {
            title: draft.readingTitle,
            ...(draft.readingPicture.trim() ? { picture: draft.readingPicture.trim() } : {}),
            paragraphs: draft.readingText
              .split(/\r?\n\s*\r?\n/)
              .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, ' ').trim())
              .filter(Boolean),
            glossary: lines(draft.glossary).map((line) => {
              const [term = '', meaning = '', ja = ''] = pipe(line);
              return { term, meaning, ja };
            }),
            questions: draft.readingQuestions.map((question, index) =>
              mcqInput(question, readingIds[index] ?? `reading-${index + 1}`),
            ),
          },
        }
      : {}),
    quizLength: Number(draft.quizLength) || 8,
    source: 'custom',
  };
}

/** A small, complete example lesson, so a teacher (or recruiter) can try the editor in one click. */
export function sampleDraft(): Draft {
  const draft = emptyDraft();
  const mcq = emptyMcq();
  const listening = emptyListening();
  return {
    ...draft,
    title: 'What Colour Is It?',
    titleJa: 'なに色かな？',
    summary: 'Name colours and ask “What colour is it?” — “It’s red!”',
    level: 'Pre-A1',
    cefrJ: 'Pre-A1',
    audiences: ['elementary'],
    topic: 'Colours',
    cover: '🎨',
    minutes: 15,
    objectives: 'Can name 4 colours.\nCan ask and answer “What colour is it?”',
    successCriteria: 'Matches all 4 colours to pictures.\nScores 70% or more on the lesson check.',
    studentEn: 'Look, listen and say the colours!',
    studentJa: 'いろを見て、きいて、言ってみよう！',
    overview:
      'A short colours lesson for lower elementary classes. Use real objects in the classroom.',
    steps:
      'Show coloured objects and say the colours.\nStudents learn the words and play matching.\nPlay “Touch something red!” then finish with the lesson check.',
    vocab: [
      {
        ...emptyVocab(),
        word: 'red',
        ja: 'あか',
        picture: '🍎',
        partOfSpeech: 'adjective',
        example: 'The apple is [red].',
        exampleJa: 'りんごは あかい。',
      },
      {
        ...emptyVocab(),
        word: 'yellow',
        ja: 'きいろ',
        picture: '🍌',
        partOfSpeech: 'adjective',
        example: 'The banana is [yellow].',
        exampleJa: 'バナナは きいろい。',
      },
      {
        ...emptyVocab(),
        word: 'green',
        ja: 'みどり',
        picture: '🥦',
        partOfSpeech: 'adjective',
        example: 'Broccoli is [green].',
        exampleJa: 'ブロッコリーは みどり。',
      },
      {
        ...emptyVocab(),
        word: 'blue',
        ja: 'あお',
        picture: '🐳',
        partOfSpeech: 'adjective',
        example: 'The whale is [blue].',
        exampleJa: 'くじらは あおい。',
      },
    ],
    grammarEnabled: true,
    grammarTitle: 'What colour is it?',
    grammarPattern: 'What colour is it? → It’s + colour.',
    grammarEn: 'Ask “What colour is it?” and answer “It’s” + a colour.',
    grammarJa: '「なに色？」は What colour is it? とたずね、It’s ＋ 色 でこたえます。',
    grammarExamples:
      '# Ask and answer | たずねる・こたえる\nWhat colour is it? — [It’s red]. | なに色？ ― あかだよ。\nWhat colour is it? — [It’s blue]. | なに色？ ― あおだよ。',
    grammarMistakes:
      'It red. | It’s red. | Don’t forget “’s” (it is). | it is の ’s をわすれずに。',
    practice: [
      {
        ...mcq,
        prompt: 'What colour is it?',
        promptJa: 'なに色？',
        picture: '🍌',
        options: [option('It’s yellow.'), option('It’s red.'), option('It’s blue.')],
        answer: 0,
        explanation: 'Bananas are yellow: “It’s yellow.”',
        optionFeedback: [
          '',
          'Look again — 🍎 is red, but 🍌 is yellow.',
          'Blue is the colour of the sea.',
        ],
        tags: 'vocabulary',
      },
      {
        ...(emptyQuestion('build') as BuildDraft),
        prompt: 'なに色ですか？',
        answer: 'What colour is it?',
        distractors: 'are',
        explanation: 'What colour + is it?',
        tags: 'word-order',
      },
    ],
    listening: [
      {
        ...listening,
        script: 'A: What colour is it?\nB: It’s green.',
        question: 'What colour is it?',
        questionJa: 'なに色？',
        options: [option('green', '🟢'), option('red', '🔴'), option('yellow', '🟡')],
        answer: 0,
        pictureOnly: true,
        explanation: 'B says “It’s green.”',
        tags: 'listening-detail',
      },
    ],
    quizLength: 6,
  };
}
