/**
 * True in the claude.ai preview build (`npm run build:artifact`). That viewer blocks printing and
 * file downloads, so the UI explains it instead of offering buttons that silently do nothing.
 */
export const EMBEDDED_PREVIEW = import.meta.env.MODE === 'artifact';
