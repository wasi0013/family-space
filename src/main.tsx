import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource-variable/inter';
import '@fontsource/noto-serif-bengali/300.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/500.css';
import '@fontsource/hind-siliguri/600.css';
import { LANG } from './i18n';
import { App } from './App';
import './styles.css';

document.documentElement.lang = LANG;
// Canvas text never asks for a web font itself, so fetch the Bengali faces up front: names can
// be written in Bengali whatever the interface language.
void document.fonts.load('500 12px "Hind Siliguri"', 'অ');
void document.fonts.load('300 16px "Noto Serif Bengali"', 'অ');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
