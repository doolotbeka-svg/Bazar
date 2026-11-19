import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './contexts/I18nContext.tsx';
import { LegalPage } from './legal/LegalPage.tsx';
import { AdminPage } from './admin/AdminPage.tsx';
import './index.css';

// /privacy and /terms are standalone pages (linked from Google sign-in and the footer)
const path = window.location.pathname.replace(/\/+$/, '');
const legalKind = path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;

const isAdminHash = () => window.location.hash === '#admin';

/** The admin panel lives at /#admin; switching the hash switches pages without a reload. */
function Root() {
  const [admin, setAdmin] = useState(isAdminHash);
  useEffect(() => {
    const onHash = () => setAdmin(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (legalKind) return <LegalPage kind={legalKind} />;
  return admin ? <AdminPage /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </StrictMode>
);
