import { ArrowLeft, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';

import { fileSlug, lessonsFile, vocabularyCsv } from '../../domain/exchange';
import { AUDIENCE_LABELS, type Module } from '../../domain/schema';
import { useModule, useStore } from '../../state/context';
import { EMBEDDED_PREVIEW } from '../../config/environment';
import { Highlighted } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { downloadFile } from '../../ui/files';
import { Illustration } from '../../ui/Illustration';
import { buildWorksheet, exampleText, type Worksheet } from './worksheet';

type Material = 'flashcards' | 'worksheet' | 'answers' | 'plan';

const MATERIALS: { id: Material; label: string }[] = [
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'worksheet', label: 'Worksheet' },
  { id: 'answers', label: 'Answer key' },
  { id: 'plan', label: 'Lesson plan' },
];

export default function ExportPage({ moduleId }: { moduleId: string }) {
  const module = useModule(moduleId);
  const store = useStore();
  const [material, setMaterial] = useState<Material>('flashcards');
  const worksheet = useMemo(() => (module ? buildWorksheet(module) : null), [module]);
  usePageTitle(module ? `Export: ${module.title}` : 'Lesson not found');

  if (!module || !worksheet) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1}>Lesson not found</h1>
        <p>
          <a href="#/teacher">Back to Teacher mode</a>
        </p>
      </section>
    );
  }

  return (
    <section className="page export-page" aria-labelledby="export-title">
      <div className="no-print">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="#/teacher">
            <ArrowLeft aria-hidden="true" /> Teacher mode
          </a>
        </nav>
        <h1 id="export-title" tabIndex={-1}>
          Teaching materials: {module.title}
        </h1>
        <p className="muted">
          Choose a material, then print it or save it as a PDF from the print dialog. Files are
          generated in your browser.
        </p>
        <div className="export-toolbar">
          <div className="segmented" role="group" aria-label="Material">
            {MATERIALS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={material === item.id}
                onClick={() => setMaterial(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {EMBEDDED_PREVIEW ? (
            <p className="notice notice-info">
              This preview runs inside claude.ai, which blocks printing and file downloads. The full
              version (GitHub Pages or <code>npm run dev</code>) prints these materials and saves
              lesson and CSV files.
            </p>
          ) : null}
          <div className="button-row" hidden={EMBEDDED_PREVIEW}>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer aria-hidden="true" /> Print / Save as PDF
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadFile(
                  `${fileSlug(module.title)}.lesson.json`,
                  lessonsFile([module], store.now()),
                  'application/json',
                )
              }
            >
              <FileJson aria-hidden="true" /> Lesson file (.json)
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadFile(
                  `${fileSlug(module.title)}-vocabulary.csv`,
                  vocabularyCsv(module),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <FileSpreadsheet aria-hidden="true" /> Vocabulary (.csv)
            </button>
          </div>
        </div>
      </div>

      <div className="print-area" aria-label="Print preview">
        {material === 'flashcards' ? <Flashcards module={module} /> : null}
        {material === 'worksheet' ? <WorksheetView module={module} worksheet={worksheet} /> : null}
        {material === 'answers' ? <AnswerKey module={module} worksheet={worksheet} /> : null}
        {material === 'plan' ? <LessonPlan module={module} /> : null}
      </div>
    </section>
  );
}

function SheetHeader({ module, title }: { module: Module; title: string }) {
  return (
    <header className="sheet-header">
      <p className="sheet-kicker">
        Eigo Steps · {module.title} · CEFR {module.level}
      </p>
      <h2>{title}</h2>
    </header>
  );
}

function Flashcards({ module }: { module: Module }) {
  return (
    <div className="sheet">
      <SheetHeader module={module} title="Flashcards" />
      <p className="sheet-note no-print">
        Cut along the dashed lines. Fold the bottom strip back to hide the word for a guessing game.
      </p>
      <ul className="print-cards">
        {module.vocab.map((item) => (
          <li key={item.id} className="print-card">
            <Illustration emoji={item.picture} size="xl" />
            <p className="print-card-word" lang="en">
              {item.word}
            </p>
            <p className="print-card-example">
              <Highlighted text={item.example} />
            </p>
            {item.ja ? (
              <p className="print-card-ja" lang="ja">
                {item.ja}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NameLine() {
  return (
    <p className="name-line">Name: ______________________ Class: ________ Date: ____________</p>
  );
}

function WorksheetView({ module, worksheet }: { module: Module; worksheet: Worksheet }) {
  let part = 0;
  const nextPart = () => String.fromCharCode(65 + part++);
  return (
    <div className="sheet">
      <SheetHeader module={module} title="Worksheet" />
      <NameLine />
      {worksheet.matching.pictures.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Vocabulary: write the letter of the word.</h3>
          <div className="ws-match">
            <ol className="ws-pictures">
              {worksheet.matching.pictures.map((item) => (
                <li key={item.number}>
                  <span className="ws-num">{item.number}.</span>
                  <Illustration emoji={item.picture} size="md" />
                  <span className="ws-blank">( &nbsp;&nbsp;&nbsp; )</span>
                </li>
              ))}
            </ol>
            <ul className="ws-words">
              {worksheet.matching.words.map((item) => (
                <li key={item.letter}>
                  {item.letter}. {item.word}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {worksheet.gapFill.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Fill in the blanks.</h3>
          <ol>
            {worksheet.gapFill.map((item) => (
              <li key={item.number}>
                {item.sentence}
                {item.choices.length > 0 ? (
                  <span className="ws-choices"> [ {item.choices.join(' / ')} ]</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {worksheet.choice.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Circle the correct answer.</h3>
          <ol>
            {worksheet.choice.map((item) => (
              <li key={item.number}>
                {item.prompt}
                <ul className="ws-options">
                  {item.options.map((option) => (
                    <li key={option.letter}>
                      {option.letter}) {option.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {worksheet.order.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Put the words in order.</h3>
          <ol>
            {worksheet.order.map((item) => (
              <li key={item.number}>
                <span lang="ja">{item.prompt}</span>
                <p className="ws-tiles">{item.tiles.join('  /  ')}</p>
                <p className="ws-line">______________________________________________</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {worksheet.reading ? (
        <section className="sheet-section">
          <h3>
            Part {nextPart()} · Read and answer: {worksheet.reading.title}
          </h3>
          {worksheet.reading.paragraphs.map((paragraph) => (
            <p key={paragraph} className="ws-passage">
              {paragraph}
            </p>
          ))}
          <ol>
            {worksheet.reading.questions.map((question) => (
              <li key={question.number}>
                {question.prompt}
                <ul className="ws-options">
                  {question.options.map((option) => (
                    <li key={option.letter}>
                      {option.letter}) {option.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function AnswerKey({ module, worksheet }: { module: Module; worksheet: Worksheet }) {
  let part = 0;
  const nextPart = () => String.fromCharCode(65 + part++);
  return (
    <div className="sheet">
      <SheetHeader module={module} title="Answer key" />
      {worksheet.matching.pictures.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Vocabulary</h3>
          <p>
            {worksheet.matching.pictures.map((item) => `${item.number}-${item.word}`).join('   ')}
          </p>
        </section>
      ) : null}
      {worksheet.gapFill.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Fill in the blanks</h3>
          <ol>
            {worksheet.gapFill.map((item) => (
              <li key={item.number}>{item.answer}</li>
            ))}
          </ol>
        </section>
      ) : null}
      {worksheet.choice.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Multiple choice</h3>
          <p>{worksheet.choice.map((item) => `${item.number}-${item.answer}`).join('   ')}</p>
        </section>
      ) : null}
      {worksheet.order.length > 0 ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Word order</h3>
          <ol>
            {worksheet.order.map((item) => (
              <li key={item.number}>{item.answer}</li>
            ))}
          </ol>
        </section>
      ) : null}
      {worksheet.reading ? (
        <section className="sheet-section">
          <h3>Part {nextPart()} · Reading</h3>
          <p>
            {worksheet.reading.questions.map((item) => `${item.number}-${item.answer}`).join('   ')}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function LessonPlan({ module }: { module: Module }) {
  const t = module.teacherInstructions;
  return (
    <div className="sheet">
      <SheetHeader module={module} title="Lesson plan" />
      <dl className="plan-meta">
        <div>
          <dt>Level</dt>
          <dd>
            CEFR {module.level}
            {module.cefrJ && module.cefrJ !== module.level ? ` (CEFR-J ${module.cefrJ})` : ''}
          </dd>
        </div>
        <div>
          <dt>Learners</dt>
          <dd>{module.audiences.map((audience) => AUDIENCE_LABELS[audience].en).join(', ')}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{module.minutes} minutes</dd>
        </div>
        <div>
          <dt>Materials</dt>
          <dd>Eigo Steps on student devices, printed flashcards, worksheet</dd>
        </div>
      </dl>
      <section className="sheet-section">
        <h3>Learning objectives</h3>
        <ul>
          {module.objectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3>Success criteria</h3>
        <ul>
          {module.successCriteria.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="sheet-section">
        <h3>Overview</h3>
        <p>{t.overview}</p>
        <h3>Procedure</h3>
        <ol>
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      {t.differentiation.length > 0 || t.commonErrors.length > 0 ? (
        <section className="sheet-section">
          {t.differentiation.length > 0 ? (
            <>
              <h3>Differentiation</h3>
              <ul>
                {t.differentiation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {t.commonErrors.length > 0 ? (
            <>
              <h3>Common errors</h3>
              <ul>
                {t.commonErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
      <section className="sheet-section">
        <h3>Feedback</h3>
        <p>{module.feedback}</p>
        <h3>Assessment</h3>
        <p>
          <strong>Formative:</strong> {module.assessment.formative}
        </p>
        <p>
          <strong>Summative:</strong> {module.assessment.summative} Pass mark:{' '}
          {module.assessment.passMark}%.
        </p>
      </section>
      {module.vocab.length > 0 ? (
        <section className="sheet-section">
          <h3>Target vocabulary</h3>
          <p>
            {module.vocab
              .map((item) => `${item.word}${item.ja ? ` (${item.ja})` : ''}`)
              .join(' · ')}
          </p>
          {module.grammar ? (
            <>
              <h3>Target grammar</h3>
              <p>
                {module.grammar.title}: {exampleText(module.grammar.pattern)}
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
