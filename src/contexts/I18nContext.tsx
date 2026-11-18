import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import kgTranslations from '../locales/kg.json';
import ruTranslations from '../locales/ru.json';
import { Language } from '../types/marketplace';

type Translations = typeof kgTranslations;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (path: string) => string;
  dict: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'tezbazar_lang';

function resolvePath(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Kyrgyz language is strictly the default on first entry
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'kg') return saved;
    } catch {
      // ignore storage access errors
    }
    return 'kg';
  });

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(STORAGE_KEY, nextLang);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'kg' ? 'ky' : 'ru';
  }, [lang]);

  const dict = lang === 'kg' ? kgTranslations : ruTranslations;

  const t = useCallback(
    (path: string) => {
      return resolvePath(dict as unknown as Record<string, unknown>, path);
    },
    [dict]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
