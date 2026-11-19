import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './contexts/I18nContext.tsx';
import { LegalPage } from './legal/LegalPage.tsx';
import './index.css';

// /privacy and /terms are standalone pages (linked from Google sign-in and the footer)
const path = window.location.pathname.replace(/\/+$/, '');
const legalKind = path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>{legalKind ? <LegalPage kind={legalKind} /> : <App />}</I18nProvider>
  </StrictMode>
);
