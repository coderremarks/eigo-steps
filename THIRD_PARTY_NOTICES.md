# Third-party notices

## Bundled assets

| Asset                                        | Source                                                                                | Licence                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 160 illustrations in `public/illustrations/` | [Noto Emoji](https://github.com/googlefonts/noto-emoji) (`2D/svg`), © 2013 Google LLC | SIL Open Font License 1.1 (full text: `public/illustrations/LICENSE-OFL.txt`) |

The illustrations are downloaded unmodified by `scripts/fetch-illustrations.mjs`. The script checks
that each file is a plain SVG (no scripts, event handlers or external references).

## Runtime libraries (in the production bundle)

| Package              | Licence |
| -------------------- | ------- |
| react, react-dom     | MIT     |
| zod                  | MIT     |
| lucide-react (icons) | ISC     |

Development tools (Vite, Vitest, Playwright, axe-core, ESLint, Prettier, TypeScript, Testing
Library) are not shipped to users. Their licences are listed in their packages under
`node_modules/`.

## Audio

Pronunciation audio is produced at runtime by the speech voices installed on the learner's device
(Web Speech API). No audio files are bundled and no audio is sent to any server.

## Lesson content

All lesson texts, dialogues, questions and explanations are original to this project. They follow
the topics of the Japanese Course of Study but do not reproduce any textbook.
