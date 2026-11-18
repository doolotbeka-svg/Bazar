import React from 'react';
import { Heart, Plus, User } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { AppView, UserProfile } from '../types/marketplace';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenPostAd: () => void;
  favoritesCount: number;
  user: UserProfile | null;
  onOpenFavorites: () => void;
}

export function Header({
  currentView,
  onNavigate,
  onOpenPostAd,
  favoritesCount,
  user,
  onOpenFavorites
}: HeaderProps) {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 h-[54px] md:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 rounded"
        >
          <span className="w-2.5 h-6 rounded-sm bg-emerald-600 inline-block" aria-hidden="true" />
          <span>{t('brand')}</span>
        </button>

        {/* Zone 2: Clean single-line navigation links + KG | RU switcher */}
        <nav className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                currentView === 'home'
                  ? 'border-emerald-600 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              {t('nav.catalog')}
            </button>
            <button
              type="button"
              onClick={onOpenFavorites}
              className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Heart className="w-4 h-4 text-slate-500" />
              <span>{t('nav.favorites')}</span>
              {favoritesCount > 0 && (
                <span className="tabular-nums text-xs font-semibold text-emerald-700">
                  ({favoritesCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('account')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentView === 'account'
                  ? 'border-emerald-600 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-slate-500" />
              <span>{user ? user.name : t('nav.account')}</span>
            </button>
          </div>

          {/* Prominent KG | RU Language Switcher */}
          <div
            role="group"
            aria-label="Language switcher"
            className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg shrink-0"
          >
            <button
              type="button"
              onClick={() => setLang('kg')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[32px] ${
                lang === 'kg'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              KG
            </button>
            <button
              type="button"
              onClick={() => setLang('ru')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[32px] ${
                lang === 'ru'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RU
            </button>
          </div>
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="hidden sm:flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenPostAd}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('nav.postAd')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
