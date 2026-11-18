import type { ReactNode } from 'react';

import { ServicesContext, type Services } from './context';

/** Provides the store and the speech engine (real in the browser, fakes in tests). */
export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
