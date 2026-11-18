import React from 'react';
import { Search, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { KYRGYZSTAN_LOCATIONS } from '../data/locations';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { CategoryId, SortOption } from '../types/marketplace';

interface SearchAndFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  locationId: string;
  onLocationChange: (loc: string) => void;
  categoryId: CategoryId | 'all';
  onCategoryChange: (cat: CategoryId | 'all') => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  negotiableOnly: boolean;
  onNegotiableOnlyChange: (val: boolean) => void;
  onSubmitSearch: () => void;
}

export function SearchAndFilters({
  query,
  onQueryChange,
  locationId,
  onLocationChange,
  categoryId,
  onCategoryChange,
  sortBy,
  onSortChange,
  negotiableOnly,
  onNegotiableOnlyChange,
  onSubmitSearch
}: SearchAndFiltersProps) {
  const { lang, t } = useI18n();

  const cities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city');
  const regions = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'region');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitSearch();
  };

  return (
    <section className="pt-6 pb-4">
      {/* Editorial Hero Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight text-balance max-w-3xl">
          {t('hero.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
          {t('hero.subtitle')}
        </p>
      </div>

      {/* Unified Search Bar */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-slate-50 border border-slate-200 rounded-2xl p-2 sm:p-2.5 flex flex-col lg:flex-row gap-2"
      >
        {/* Text query */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('hero.searchPlaceholder')}
            className="w-full h-11 pl-10 pr-9 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Location & Category Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2">
          <div className="relative lg:w-52">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={locationId}
              onChange={(e) => onLocationChange(e.target.value)}
              aria-label={t('hero.allLocations')}
              className="w-full h-11 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer appearance-none"
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
          </div>

          <div className="relative lg:w-52">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value as CategoryId | 'all')}
              aria-label={t('hero.allCategories')}
              className="w-full h-11 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer appearance-none"
            >
              <option value="all">{t('hero.allCategories')}</option>
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {t(`categories.${cat.id}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t('hero.searchButton')}
        </button>
      </form>

      {/* Secondary Inline Filter Row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none min-h-[36px]">
          <input
            type="checkbox"
            checked={negotiableOnly}
            onChange={(e) => onNegotiableOnlyChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
          />
          <span>{t('feed.negotiableOnly')}</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{t('feed.sortLabel')}:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer"
          >
            <option value="newest">{t('feed.sortNewest')}</option>
            <option value="price_asc">{t('feed.sortPriceAsc')}</option>
            <option value="price_desc">{t('feed.sortPriceDesc')}</option>
            <option value="views">{t('feed.sortViews')}</option>
          </select>
        </div>
      </div>
    </section>
  );
}
