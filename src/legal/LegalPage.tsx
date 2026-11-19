import { useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { CONTACT_PHONE, CONTACT_TELEGRAM_URL, LEGAL, type LegalKind } from './content';

/** Standalone page for /privacy and /terms (plain links, works without the app state). */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const { lang, setLang } = useI18n();
  const doc = LEGAL[kind][lang === 'kg' ? 'kg' : 'ru'];
  const other: LegalKind = kind === 'privacy' ? 'terms' : 'privacy';
  const otherTitle = LEGAL[other][lang === 'kg' ? 'kg' : 'ru'].title;

  useEffect(() => {
    document.title = `${doc.title} — AlMart`;
  }, [doc.title]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-display text-[22px] font-extrabold">
            <span className="text-brand-800">Al</span>
            <span className="text-go-500">Mart</span>
          </a>
          <div className="flex gap-1 text-xs font-bold">
            {(['kg', 'ru'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2 py-1 rounded-md cursor-pointer ${lang === l ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{doc.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{doc.updated}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-slate-700">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.title} className="mt-7">
            <h2 className="text-lg font-bold text-slate-900">{s.title}</h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-slate-700">
                {p}
              </p>
            ))}
            {s.items && (
              <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[15px] leading-relaxed text-slate-700">
                {s.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="mt-8 text-[15px]">
          <a href={CONTACT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
            {lang === 'kg' ? 'Telegram аркылуу жазуу' : 'Написать в Telegram'}: {CONTACT_PHONE}
          </a>
        </p>
      </main>

      <footer className="bg-tile">
        <div className="max-w-3xl mx-auto px-4 py-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="/" className="text-slate-700 hover:text-brand-700">
            {lang === 'kg' ? 'Башкы бет' : 'На главную'}
          </a>
          <a href={`/${other}`} className="text-slate-700 hover:text-brand-700">
            {otherTitle}
          </a>
        </div>
      </footer>
    </div>
  );
}
