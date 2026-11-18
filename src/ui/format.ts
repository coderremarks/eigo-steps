import { useEffect } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Eigo Steps`;
  }, [title]);
}

/** "ja" when the text contains Japanese script, so screen readers switch voice. */
export function langOf(text: string): 'ja' | 'en' {
  return /[぀-ヿ㐀-鿿ｦ-ﾟ]/u.test(text) ? 'ja' : 'en';
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
}
