import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createBrowserSpeech } from './services/speech';
import { createBrowserStore } from './services/storage';
import { ServicesProvider } from './state/ServicesProvider';
import { AppStore } from './state/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/activities.css';
import './styles/teacher.css';
import './styles/print.css';

const store = new AppStore(createBrowserStore());
const speech = createBrowserSpeech();
speech.setPreferredVoice(store.getState().settings.voiceURI);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={{ store, speech }}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
