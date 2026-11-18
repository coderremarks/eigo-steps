/**
 * Builds printable teaching materials from a lesson: a worksheet (vocabulary matching, gap fill,
 * word order, reading) with a matching answer key. Generation is seeded by the lesson id, so the
 * worksheet and its answer key always agree, and reprints are identical.
 */
import type { Module } from '../../domain/schema';
import { createRng, hashString, shuffle } from '../../domain/random';
import { BLANK } from '../../domain/schema';
import { buildTiles } from '../../domain/grading';
import { stripHighlights } from '../../domain/text';

export interface Worksheet {
  matching: {
    pictures: { number: number; picture: string; word: string }[];
    words: { letter: string; word: string }[];
  };
  gapFill: { number: number; sentence: string; choices: string[]; answer: string }[];
  choice: {
    number: number;
    prompt: string;
    options: { letter: string; text: string }[];
    answer: string;
  }[];
  order: { number: number; prompt: string; tiles: string[]; answer: string }[];
  reading?: {
    title: string;
    paragraphs: string[];
    questions: {
      number: number;
      prompt: string;
      options: { letter: string; text: string }[];
      answer: string;
    }[];
  };
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function buildWorksheet(module: Module): Worksheet {
  const rng = createRng(hashString(`worksheet-${module.id}`));
  const words = module.vocab.slice(0, 10);
  const shuffledWords = shuffle(words, rng);
  const letterOf = new Map(shuffledWords.map((item, index) => [item.id, LETTERS[index] ?? '?']));

  let fillNumber = 0;
  let choiceNumber = 0;
  let orderNumber = 0;
  const gapFill: Worksheet['gapFill'] = [];
  const choice: Worksheet['choice'] = [];
  const order: Worksheet['order'] = [];
  for (const question of module.practice) {
    if (question.kind === 'fill') {
      fillNumber += 1;
      gapFill.push({
        number: fillNumber,
        sentence: question.sentence.replace(BLANK, '__________'),
        choices: shuffle(question.choices, rng),
        answer: question.answers[0] ?? '',
      });
    } else if (question.kind === 'mcq') {
      choiceNumber += 1;
      const options = question.shuffle
        ? shuffle(
            question.options.map((option, index) => ({ option, index })),
            rng,
          )
        : question.options.map((option, index) => ({ option, index }));
      choice.push({
        number: choiceNumber,
        prompt: `${question.picture ? `${question.picture} ` : ''}${question.prompt}`,
        options: options.map((entry, index) => ({
          letter: LETTERS[index] ?? '?',
          text: entry.option.text,
        })),
        answer: LETTERS[options.findIndex((entry) => entry.index === question.answer)] ?? '?',
      });
    } else {
      orderNumber += 1;
      order.push({
        number: orderNumber,
        prompt: question.prompt,
        tiles: shuffle(buildTiles(question), rng),
        answer: question.answer,
      });
    }
  }

  const reading = module.reading
    ? {
        title: module.reading.title,
        paragraphs: module.reading.paragraphs,
        questions: module.reading.questions.map((question, index) => {
          const options = question.shuffle
            ? shuffle(
                question.options.map((option, i) => ({ option, i })),
                rng,
              )
            : question.options.map((option, i) => ({ option, i }));
          return {
            number: index + 1,
            prompt: question.prompt,
            options: options.map((entry, i) => ({
              letter: LETTERS[i] ?? '?',
              text: entry.option.text,
            })),
            answer: LETTERS[options.findIndex((entry) => entry.i === question.answer)] ?? '?',
          };
        }),
      }
    : undefined;

  return {
    matching: {
      pictures: words.map((item, index) => ({
        number: index + 1,
        picture: item.picture,
        word: letterOf.get(item.id) ?? '?',
      })),
      words: shuffledWords.map((item, index) => ({
        letter: LETTERS[index] ?? '?',
        word: item.word,
      })),
    },
    gapFill,
    choice,
    order,
    reading,
  };
}

export function exampleText(value: string): string {
  return stripHighlights(value);
}
