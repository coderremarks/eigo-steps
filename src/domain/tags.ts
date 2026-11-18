/**
 * Learning-focus tags. Every question is tagged with what it practises, which is how the app turns
 * individual answers into "areas to review" for learners and class-wide insights for teachers.
 * Many tags name a predictable error for Japanese-speaking learners (L1 transfer), so feedback and
 * re-teaching can target the cause, not just the wrong answer.
 */

export interface TagInfo {
  label: string;
  ja: string;
  /** One-line note for teachers about why this is hard. */
  teacherNote: string;
  /** Extra hint for word-order mistakes in sentence building. */
  orderHint?: string;
}

export const TAGS: Record<string, TagInfo> = {
  vocabulary: {
    label: 'Word meanings',
    ja: '単語の意味',
    teacherNote: 'Recognising the meaning of new words from a picture or sound.',
  },
  feelings: {
    label: 'Feelings words',
    ja: '気持ちを表すことば',
    teacherNote: 'Learners often answer "I\'m fine" by habit; check they choose a real feeling.',
  },
  greetings: {
    label: 'Greetings',
    ja: 'あいさつ',
    teacherNote: 'Time-of-day greetings (good morning / good night) are often swapped.',
  },
  'be-verb': {
    label: "I'm = I am",
    ja: 'be動詞（I am）',
    teacherNote: 'Japanese has no copula in the same position, so "I happy" is a common error.',
  },
  'be-vs-verb': {
    label: 'am/is + action verb',
    ja: 'be動詞と一般動詞',
    teacherNote:
      '"I am play tennis" is one of the most frequent errors in Japanese junior high schools.',
  },
  'plural-s': {
    label: 'Plural -s (I like dogs)',
    ja: '複数形の s',
    teacherNote: 'Japanese nouns have no plural ending, so "I like dog" is very common.',
  },
  'do-questions': {
    label: 'Do you…? / Yes, I do',
    ja: 'Do you〜? の疑問文と答え方',
    teacherNote: 'Learners answer "Yes, I like" instead of "Yes, I do".',
    orderHint: 'In questions, "Do" comes first: Do + you + verb…?',
  },
  negatives: {
    label: "Negatives (don't)",
    ja: "否定文（don't）",
    teacherNote: 'Watch for "I not like" or "I no like".',
    orderHint: "Put don't before the verb: I don't like…",
  },
  'word-order': {
    label: 'Word order',
    ja: '語順',
    teacherNote: 'English is subject-verb-object; Japanese is subject-object-verb.',
    orderHint: 'English order is: who → does what → what/where/when.',
  },
  'polite-requests': {
    label: "Polite requests (I'd like…)",
    ja: "ていねいな頼み方（I'd like〜）",
    teacherNote: '"I want" sounds direct to staff; "I\'d like…, please" is the polite chunk.',
    orderHint: "Polite order: I'd like + thing + , please.",
  },
  'how-much': {
    label: 'How much? (prices)',
    ja: 'How much（値段のたずね方）',
    teacherNote: '"How many" is used for prices by mistake.',
  },
  prices: {
    label: 'Prices in yen',
    ja: '値段（円）',
    teacherNote: '"yen" never takes a plural -s.',
  },
  'third-person-s': {
    label: 'He/She + verb-s',
    ja: '三人称単数現在の s',
    teacherNote: 'The single most persistent JHS error: "He play tennis".',
    orderHint: 'Subject first, then the verb: He plays…',
  },
  'spelling-es': {
    label: 'Spelling: -es endings',
    ja: 'つづり（-es）',
    teacherNote: 'go → goes, do → does, watch → watches.',
  },
  'do-does-questions': {
    label: 'What time do/does…?',
    ja: 'What time do/does〜? の疑問文',
    teacherNote: 'After "does", the verb goes back to the base form.',
    orderHint: 'Question order: What time + do/does + subject + verb?',
  },
  directions: {
    label: 'Giving directions',
    ja: '道案内の表現',
    teacherNote: '"Go to straight" and "turn to left" come from Japanese particles.',
    orderHint: 'Directions start with the verb: Go straight. Turn left.',
  },
  prepositions: {
    label: 'next to / between / in front of',
    ja: '場所を表す前置詞',
    teacherNote: 'Japanese places these after the noun (〜のとなり), so order slips.',
  },
  articles: {
    label: 'a / an / the',
    ja: '冠詞（a / an / the）',
    teacherNote: 'Japanese has no articles; "Where is station?" is typical.',
    orderHint: 'Put "the" right before the place: the station.',
  },
  'past-regular': {
    label: 'Past tense: -ed verbs',
    ja: '過去形（規則動詞）',
    teacherNote: 'Spelling and pronunciation of -ed (played / watched / visited).',
  },
  'past-irregular': {
    label: 'Past tense: irregular verbs',
    ja: '過去形（不規則動詞）',
    teacherNote:
      'Over-regularisation ("goed", "eated") shows the rule is learned but not the exceptions.',
  },
  'did-questions': {
    label: 'Did you…? / What did you do?',
    ja: 'Did を使った疑問文',
    teacherNote: 'After "did", the verb returns to the base form: "Did you went" is common.',
    orderHint: 'Question order: What + did + you + verb…?',
  },
  'past-be': {
    label: 'It was fun / I enjoyed it',
    ja: 'It was fun / I enjoyed it',
    teacherNote: '"It was very enjoy" is a classic error: enjoy is a verb, not an adjective.',
  },
  'listening-detail': {
    label: 'Listening for key details',
    ja: '要点を聞き取る',
    teacherNote: 'Pre-teach the question so learners know what to listen for.',
  },
  'listening-numbers': {
    label: 'Listening for numbers and prices',
    ja: '数字・値段の聞き取り',
    teacherNote: '-teen vs -ty (fifteen / fifty) and hundreds are frequent confusions.',
  },
  'listening-time': {
    label: 'Listening for times',
    ja: '時刻の聞き取り',
    teacherNote: 'Practise "six fifteen" vs "six fifty" with minimal pairs.',
  },
  'listening-directions': {
    label: 'Following spoken directions',
    ja: '道案内の聞き取り',
    teacherNote: 'Left/right and first/second corner need quick processing.',
  },
  'listening-inference': {
    label: 'Understanding feelings and opinions',
    ja: '気持ち・意見の聞き取り',
    teacherNote: 'Listen for tone and words like "boring" or "exciting".',
  },
  'reading-detail': {
    label: 'Reading for details',
    ja: '詳細の読み取り',
    teacherNote: 'Encourage scanning for names, numbers and times.',
  },
  'reading-inference': {
    label: 'Reading between the lines',
    ja: '推測しながら読む',
    teacherNote: 'Questions where the answer is implied, not stated word for word.',
  },
};

export function tagInfo(tag: string): TagInfo {
  return (
    TAGS[tag] ?? {
      label: tag.replace(/-/g, ' '),
      ja: '',
      teacherNote: 'Custom focus area added by a teacher.',
    }
  );
}
