import { lazy, Suspense, useEffect, useRef } from 'react';

import { LandingPage } from '../features/home/LandingPage';
import { StudentHome } from '../features/home/StudentHome';
import { ActivityPage } from '../features/activities/ActivityPage';
import { ModuleOverview } from '../features/modules/ModuleOverview';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { Layout } from './Layout';
import { routeToHash, useRoute, type Route } from './router';

// Teacher tools and the project page are loaded on demand to keep the learner bundle small.
const TeacherHome = lazy(() => import('../features/teacher/TeacherHome'));
const LessonEditor = lazy(() => import('../features/teacher/LessonEditor'));
const ExportPage = lazy(() => import('../features/teacher/ExportPage'));
const ClassPage = lazy(() => import('../features/teacher/ClassPage'));
const AboutPage = lazy(() => import('../features/about/AboutPage'));

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'landing':
      return <LandingPage />;
    case 'learn':
      return <StudentHome />;
    case 'module':
      return <ModuleOverview moduleId={route.moduleId} />;
    case 'activity':
      return (
        <ActivityPage
          key={routeToHash(route)}
          moduleId={route.moduleId}
          kind={route.kind}
          preview={route.preview}
        />
      );
    case 'review':
      return <ReviewPage />;
    case 'progress':
      return <ProgressPage />;
    case 'settings':
      return <SettingsPage />;
    case 'teacher':
      return <TeacherHome />;
    case 'teacher-new':
      return <LessonEditor key="new" />;
    case 'teacher-edit':
      return (
        <LessonEditor
          key={routeToHash(route)}
          moduleId={route.moduleId}
          duplicate={route.duplicate}
        />
      );
    case 'teacher-export':
      return <ExportPage moduleId={route.moduleId} />;
    case 'teacher-class':
      return <ClassPage />;
    case 'about':
      return <AboutPage />;
    case 'not-found':
      return (
        <section className="page narrow">
          <h1 tabIndex={-1}>Page not found</h1>
          <p>
            That page does not exist. <a href="#/learn">Go to the lessons</a>.
          </p>
        </section>
      );
  }
}

export function App() {
  const route = useRoute();
  const hash = routeToHash(route);
  const first = useRef(true);

  // Move focus to the new page's heading so keyboard and screen-reader users land in the content.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('#main h1');
      heading?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [hash]);

  return (
    <Layout route={route}>
      <Suspense
        fallback={
          <p className="page loading" role="status">
            Loading…
          </p>
        }
      >
        <Page route={route} />
      </Suspense>
    </Layout>
  );
}
