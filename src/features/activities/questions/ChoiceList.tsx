import { Check, X } from 'lucide-react';

import type { ChoiceOption } from '../../../domain/schema';
import { Illustration } from '../../../ui/Illustration';

interface Props {
  name: string;
  legend: string;
  options: readonly ChoiceOption[];
  /** Display order (indexes into options). */
  order: readonly number[];
  selected: number | null;
  wrong: readonly number[];
  answer: number;
  resolved: boolean;
  pictureOnly: boolean;
  onSelect: (index: number) => void;
}

/** Answer options as a native radio group: keyboard, screen readers and touch all work for free. */
export function ChoiceList({
  name,
  legend,
  options,
  order,
  selected,
  wrong,
  answer,
  resolved,
  pictureOnly,
  onSelect,
}: Props) {
  const hasPictures = options.some((option) => option.picture);
  return (
    <fieldset
      className={`choices ${pictureOnly ? 'choices-pictures' : hasPictures ? 'choices-mixed' : ''}`}
    >
      <legend className="sr-only">{legend}</legend>
      {order.map((index) => {
        const option = options[index];
        if (!option) return null;
        const isWrong = wrong.includes(index);
        const state =
          resolved && index === answer
            ? 'correct'
            : isWrong
              ? 'wrong'
              : selected === index
                ? 'selected'
                : '';
        const showText = !pictureOnly || resolved;
        return (
          <label key={index} className={`choice ${state}`}>
            <input
              type="radio"
              name={name}
              value={index}
              checked={selected === index}
              disabled={resolved || isWrong}
              onChange={() => onSelect(index)}
            />
            {option.picture ? (
              <Illustration emoji={option.picture} size={pictureOnly ? 'lg' : 'sm'} />
            ) : null}
            <span className={showText ? 'choice-text' : 'sr-only'}>{option.text}</span>
            {state === 'correct' ? (
              <span className="choice-mark">
                <Check aria-hidden="true" />
                <span className="sr-only">(correct answer)</span>
              </span>
            ) : null}
            {state === 'wrong' ? (
              <span className="choice-mark">
                <X aria-hidden="true" />
                <span className="sr-only">(not correct)</span>
              </span>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}
