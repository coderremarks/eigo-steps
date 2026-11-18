import {
  BookOpen,
  ChartColumn,
  GraduationCap,
  Info,
  Menu,
  Repeat,
  Settings,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { dueCards } from '../domain/srs';
import { useAppState, useServices, useStore, useToday } from '../state/context';
import { EMBEDDED_PREVIEW } from '../config/environment';
import { ConfirmButton } from '../ui/ConfirmButton';
import { navigate, routeToHash, type Route } from './router';

const NAV: {
  name: Route['name'];
  href: string;
  label: string;
  ja: string;
  icon: typeof BookOpen;
  match: Route['name'][];
}[] = [
  {
    name: 'learn',
    href: '#/learn',
    label: 'Learn',
    ja: '学ぶ',
    icon: BookOpen,
    match: ['learn', 'module', 'activity'],
  },
  {
    name: 'review',
    href: '#/review',
    label: 'Review',
    ja: '復習',
    icon: Repeat,
    match: ['review'],
  },
  {
    name: 'progress',
    href: '#/progress',
    label: 'Progress',
    ja: '記録',
    icon: ChartColumn,
    match: ['progress'],
  },
  {
    name: 'teacher',
    href: '#/teacher',
    label: 'Teacher',
    ja: '先生用',
    icon: GraduationCap,
    match: ['teacher', 'teacher-new', 'teacher-edit', 'teacher-export', 'teacher-class'],
  },
  { name: 'about', href: '#/about', label: 'About', ja: '概要', icon: Info, match: ['about'] },
];

function DemoBanner() {
  const store = useStore();
  const demo = useAppState((state) => state.progress.demo);
  if (!demo) return null;
  return (
    <div className="demo-banner" role="region" aria-label="Demo mode">
      <p>
        <strong>Demo mode.</strong> You are viewing sample progress for “Sora”, a synthetic learner.
        Nothing is sent anywhere; it all stays in this browser.
      </p>
      <div className="demo-actions">
        <button
          type="button"
          className="btn btn-small btn-ghost"
          onClick={() => {
            store.loadDemo();
          }}
        >
          Reset demo data
        </button>
        <ConfirmButton
          className="btn btn-small"
          label="Start fresh"
          question="Clear the demo and start as a new learner?"
          confirmLabel="Start fresh"
          onConfirm={() => {
            store.startFresh();
            navigate('#/learn');
          }}
        />
      </div>
    </div>
  );
}

function SpeechNotice() {
  const { speech } = useServices();
  if (speech.supported) return null;
  return (
    <p className="notice notice-warning" role="note">
      Audio is not available in this browser, so 🔊 buttons are hidden. Transcripts are shown
      instead. (Try Chrome, Edge or Safari for pronunciation audio.)
    </p>
  );
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const page = routeToHash(route);
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === page;
  const setMenuOpen = (update: (open: boolean) => boolean) =>
    setMenuOpenOn(update(menuOpen) ? page : null);
  const progress = useAppState((state) => state.progress);
  const today = useToday();
  const due = useMemo(
    () => dueCards(Object.values(progress.srs), today).length,
    [progress.srs, today],
  );
  const recovered = useAppState((state) => state.recovered);

  const bare = route.name === 'landing';
  return (
    <div className={`app ${bare ? 'app-landing' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="32" height="32" />
            <span>
              Eigo Steps{' '}
              <span className="brand-ja" lang="ja">
                英語ステップ
              </span>
            </span>
          </a>
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">Menu</span>
          </button>
          <nav id="site-nav" className={`site-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
            <ul>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.match.includes(route.name);
                return (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'active' : ''}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.name === 'review' && due > 0 ? (
                        <span className="count-badge" aria-label={`${due} words due`}>
                          {due}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href="#/settings"
                  aria-current={route.name === 'settings' ? 'page' : undefined}
                  className={route.name === 'settings' ? 'active' : ''}
                >
                  <Settings aria-hidden="true" />
                  <span>Settings</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <DemoBanner />
      <main id="main" tabIndex={-1}>
        <SpeechNotice />
        {recovered.length > 0 ? (
          <p className="notice notice-warning" role="alert">
            Some saved data on this device could not be read and was set aside, so the app started
            with defaults.
          </p>
        ) : null}
        {children}
      </main>
      <footer className="site-footer">
        <p>
          No sign-up, no tracking: lessons and progress stay on this device. Illustrations: Noto
          Emoji (Google, SIL OFL 1.1). Audio: your device’s built-in voices.
        </p>
        {EMBEDDED_PREVIEW ? (
          <p>Preview build: printing and file downloads are turned off in this viewer.</p>
        ) : null}
        <p>
          <a href="#/about">About this project</a> · <a href="#/settings">Settings &amp; data</a>
        </p>
      </footer>
    </div>
  );
}
