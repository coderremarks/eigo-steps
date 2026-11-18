/**
 * Runtime "tasks": the questions a learner actually sees in practice sets, listening, reading,
 * lesson checks and spaced review. Built-in and teacher-written lessons go through the same
 * builders, so every lesson gets the same feedback, scoring and accessibility behaviour.
 */
import type {
  ChoiceOption,
  ListeningItem,
  McqQuestion,
  Module,
  Question,
  Skill,
  VocabItem,
} from './schema';
import { createRng, hashString, shuffle, shuffledOrder, type Rng } from './random';

export type Task =
  | { type: 'mcq'; id: string; skill: Skill; question: McqQuestion; audio?: string }
  | { type: 'fill'; id: string; skill: Skill; question: Extract<Question, { kind: 'fill' }> }
  | { type: 'build'; id: string; skill: Skill; question: Extract<Question, { kind: 'build' }> }
  | { type: 'listening'; id: string; skill: 'listening'; item: ListeningItem };

export function taskTags(task: Task): string[] {
  return task.type === 'listening' ? task.item.tags : task.question.tags;
}

export function questionToTask(question: Question, skill: Skill): Task {
  switch (question.kind) {
    case 'mcq':
      return { type: 'mcq', id: question.id, skill, question };
    case 'fill':
      return { type: 'fill', id: question.id, skill, question };
    case 'build':
      return { type: 'build', id: question.id, skill, question };
  }
}

export function practiceTasks(module: Module): Task[] {
  return module.practice.map((question) => questionToTask(question, 'grammar'));
}

export function listeningTasks(module: Module): Task[] {
  return module.listening.map((item) => ({
    type: 'listening',
    id: item.id,
    skill: 'listening',
    item,
  }));
}

export function readingTasks(module: Module): Task[] {
  return (module.reading?.questions ?? []).map((question) => questionToTask(question, 'reading'));
}

/** Display order for answer options, stable for a given question and attempt seed. */
export function optionOrder(
  options: readonly ChoiceOption[],
  shuffleOptions: boolean,
  seed: number,
): number[] {
  if (!shuffleOptions) return options.map((_, index) => index);
  return shuffledOrder(options.length, createRng(seed));
}

function distractorWords(
  target: VocabItem,
  pool: readonly VocabItem[],
  rng: Rng,
  count: number,
): VocabItem[] {
  return shuffle(
    pool.filter(
      (item) => item.id !== target.id && item.word.toLowerCase() !== target.word.toLowerCase(),
    ),
    rng,
  ).slice(0, count);
}

export type VocabTaskMode = 'picture-to-word' | 'audio-to-picture' | 'meaning-to-word';

/** Generates a vocabulary multiple-choice task from a word list. */
export function vocabTask(
  target: VocabItem,
  pool: readonly VocabItem[],
  mode: VocabTaskMode,
  rng: Rng,
): Task {
  const others = distractorWords(target, pool, rng, 2);
  const choices = [target, ...others];
  const base = {
    id: `vocab-${target.id}`,
    explanation: `${target.picture} = ${target.word}. ${target.example.replace(/[[\]]/g, '')}`,
    optionFeedback: [],
    shuffle: true,
    tags: ['vocabulary'],
    answer: 0,
    promptJa: '',
  };
  if (mode === 'audio-to-picture') {
    const question: McqQuestion = {
      ...base,
      kind: 'mcq',
      prompt: 'Listen. Which picture is it?',
      promptJa: '聞いて、合う絵をえらぼう。',
      options: choices.map((item) => ({ text: item.word, picture: item.picture })),
      pictureOnly: true,
    };
    return { type: 'mcq', id: base.id, skill: 'vocabulary', question, audio: target.word };
  }
  if (mode === 'meaning-to-word' && target.ja) {
    const question: McqQuestion = {
      ...base,
      kind: 'mcq',
      prompt: `Which English word means "${target.ja}"?`,
      promptJa: `「${target.ja}」は英語で何と言う？`,
      options: choices.map((item) => ({ text: item.word })),
      pictureOnly: false,
    };
    return { type: 'mcq', id: base.id, skill: 'vocabulary', question };
  }
  const question: McqQuestion = {
    ...base,
    kind: 'mcq',
    prompt: 'What is this?',
    promptJa: 'これは何？',
    picture: target.picture,
    options: choices.map((item) => ({ text: item.word })),
    pictureOnly: false,
  };
  return { type: 'mcq', id: base.id, skill: 'vocabulary', question };
}

/**
 * The lesson check: a seeded, interleaved mix of vocabulary (~35%), grammar (~40%) and
 * listening (~25%) items, rebalanced when a lesson has fewer of one kind.
 */
export function quizTasks(module: Module, seed: number): Task[] {
  const rng = createRng(seed ^ hashString(module.id));
  const vocabPool = shuffle(module.vocab, rng);
  const grammarPool = shuffle(practiceTasks(module), rng);
  const listeningPool = shuffle(listeningTasks(module), rng);
  const total = Math.min(
    module.quizLength,
    vocabPool.length + grammarPool.length + listeningPool.length,
  );

  const wanted = {
    vocab: Math.round(total * 0.35),
    grammar: Math.round(total * 0.4),
    listening: total - Math.round(total * 0.35) - Math.round(total * 0.4),
  };
  const take = {
    vocab: Math.min(wanted.vocab, vocabPool.length),
    grammar: Math.min(wanted.grammar, grammarPool.length),
    listening: Math.min(wanted.listening, listeningPool.length),
  };
  // Give unused slots to whichever pools still have items.
  let missing = total - take.vocab - take.grammar - take.listening;
  for (const key of ['grammar', 'vocab', 'listening'] as const) {
    const available = {
      vocab: vocabPool.length,
      grammar: grammarPool.length,
      listening: listeningPool.length,
    }[key];
    const extra = Math.min(missing, available - take[key]);
    take[key] += extra;
    missing -= extra;
  }

  const modes: VocabTaskMode[] = ['picture-to-word', 'audio-to-picture'];
  const vocabItems = vocabPool
    .slice(0, take.vocab)
    .map((item, index) =>
      vocabTask(item, module.vocab, modes[index % modes.length] ?? 'picture-to-word', rng),
    );
  return shuffle(
    [
      ...vocabItems,
      ...grammarPool.slice(0, take.grammar),
      ...listeningPool.slice(0, take.listening),
    ],
    rng,
  );
}

/** Splits a word list into matching rounds of at most `size` pairs, as evenly as possible. */
export function matchingRounds<T>(items: readonly T[], size = 6): T[][] {
  if (items.length === 0) return [];
  const rounds = Math.ceil(items.length / size);
  const base = Math.floor(items.length / rounds);
  let extra = items.length % rounds;
  const result: T[][] = [];
  let index = 0;
  for (let round = 0; round < rounds; round += 1) {
    const length = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    result.push(items.slice(index, index + length));
    index += length;
  }
  return result;
}
