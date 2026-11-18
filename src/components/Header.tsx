import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Heart, LayoutGrid, MapPin, Plus, Search, User, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { KYRGYZSTAN_LOCATIONS } from '../data/locations';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { CategoryId, Listing, UserProfile } from '../types/marketplace';
import { CATEGORY_ICONS } from './categoryIcons';

interface HeaderProps {
  onGoHome: () => void;
  onOpenPostAd: () => void;
  onOpenFavorites: () => void;
  onOpenAccount: () => void;
  favoritesCount: number;
  user: UserProfile | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSubmitSearch: () => void;
  categoryId: CategoryId | 'all';
  onCategoryChange: (cat: CategoryId | 'all') => void;
  locationId: string;
  onLocationChange: (loc: string) => void;
  listings: Listing[];
}

export function Header({
  onGoHome,
  onOpenPostAd,
  onOpenFavorites,
  onOpenAccount,
  favoritesCount,
  user,
  query,
  onQueryChange,
  onSubmitSearch,
  categoryId,
  onCategoryChange,
  locationId,
  onLocationChange,
  listings
}: HeaderProps) {
  const { lang, setLang, t } = useI18n();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);

  // Close the catalog panel on outside click / Escape
  useEffect(() => {
    if (!catalogOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) setCatalogOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [catalogOpen]);

  const cities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city');
  const regions = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'region');
  const countFor = (id: CategoryId) =>
    listings.filter((l) => l.status === 'active' && l.category === id).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogOpen(false);
    onSubmitSearch();
  };

  const langSwitch = (
    <div role="group" aria-label="Language" className="flex items-center gap-0.5">
      {(['kg', 'ru'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer ${
            lang === code ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <header className="bg-white md:sticky md:top-0 z-40 md:shadow-[0_1px_0_#ececec]">
      {/* Utility bar (desktop) */}
      <div className="hidden md:block border-b border-slate-100">
        <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center justify-between text-[13px] text-slate-600">
          <div className="flex items-center gap-5">
            {langSwitch}
            <span className="text-slate-400">{t('footer.about')}</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onOpenFavorites}
              className="flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"
            >
              <Heart className="w-4 h-4" />
              <span>{t('nav.favorites')}</span>
              {favoritesCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                  {favoritesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenAccount}
              className="flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span className="max-w-[180px] truncate">{user ? user.name : t('nav.login')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-2.5 md:py-4 flex items-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={onGoHome}
          className="shrink-0 font-display text-[22px] md:text-[26px] font-extrabold tracking-tight cursor-pointer leading-none"
          aria-label={t('nav.home')}
        >
          <span className="text-slate-900">Tez</span>
          <span className="text-brand-500">Bazar</span>
        </button>

        <div className="md:hidden ml-auto">{langSwitch}</div>

        {/* Catalog button + panel (desktop) */}
        <div ref={catalogRef} className="relative hidden md:block shrink-0">
          <button
            type="button"
            onClick={() => setCatalogOpen((v) => !v)}
            aria-expanded={catalogOpen}
            className="h-11 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold flex items-center gap-2 cursor-pointer"
          >
            {catalogOpen ? <X className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
            <span>{t('hero.allCategories')}</span>
          </button>

          {catalogOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] w-[560px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] p-3 grid grid-cols-2 gap-1">
              {MARKETPLACE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id];
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onCategoryChange(cat.id);
                      setCatalogOpen(false);
                      onSubmitSearch();
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer ${
                      active ? 'bg-brand-50 text-brand-700' : 'hover:bg-tile'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-slate-500 shrink-0" />
                    <span className="flex-1 text-[15px] font-medium">{t(`categories.${cat.id}`)}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{countFor(cat.id)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <form onSubmit={submit} className="hidden md:flex flex-1 min-w-0 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t('hero.searchShort')}
              className="w-full h-11 pl-11 pr-4 rounded-l-xl border-2 border-brand-500 border-r-0 text-[15px] focus:outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-6 rounded-r-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold cursor-pointer"
          >
            {t('hero.searchButton')}
          </button>

          <label className="relative ml-4 flex items-center gap-1.5 text-[15px] text-slate-800 cursor-pointer shrink-0 hover:text-brand-600">
            <MapPin className="w-4.5 h-4.5 text-slate-500" />
            <select
              value={locationId}
              onChange={(e) => {
                onLocationChange(e.target.value);
                onSubmitSearch();
              }}
              aria-label={t('search.city')}
              className="appearance-none bg-transparent pr-5 max-w-[170px] truncate cursor-pointer focus:outline-none"
            >
              <option value="all">{t('hero.allLocations')}</option>
              <optgroup label={t('hero.citiesGroup')}>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name[lang]}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('hero.regionsGroup')}>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name[lang]}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-0 pointer-events-none text-slate-500" />
          </label>
        </form>

        <button
          type="button"
          onClick={onOpenPostAd}
          className="hidden md:inline-flex shrink-0 h-11 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>{t('nav.postAd')}</span>
        </button>
      </div>

      {/* Mobile search */}
      <form onSubmit={submit} className="md:hidden px-4 pb-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('hero.searchShort')}
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-tile text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-500"
          />
        </div>
      </form>
    </header>
  );
}
