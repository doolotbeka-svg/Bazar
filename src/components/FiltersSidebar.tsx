import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { KYRGYZSTAN_LOCATIONS } from '../data/locations';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { CategoryId } from '../types/marketplace';

export interface SearchFilters {
  categoryId: CategoryId | 'all';
  locationId: string;
  priceFrom: string;
  priceTo: string;
  negotiableOnly: boolean;
  withPhotoOnly: boolean;
}

interface FiltersSidebarProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  categoryCounts: Record<string, number>;
  resultCount: number;
  onDone?: () => void;
}

const inputCls =
  'w-full h-10 px-3 rounded-lg bg-tile text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-500';

export function FiltersSidebar({
  filters,
  onChange,
  onReset,
  categoryCounts,
  resultCount,
  onDone
}: FiltersSidebarProps) {
  const { lang, t } = useI18n();
  const cities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city');
  const regions = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'region');
  const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      {/* Category list */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 mb-2">{t('search.category')}</h3>
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => onChange({ categoryId: 'all' })}
              className={`w-full text-left py-1 text-[15px] cursor-pointer ${
                filters.categoryId === 'all' ? 'font-semibold text-slate-900' : 'text-brand-600 hover:text-brand-800 hover:underline underline-offset-2'
              }`}
            >
              {t('hero.allCategories')}
            </button>
          </li>
          {MARKETPLACE_CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onChange({ categoryId: cat.id })}
                className={`w-full flex items-baseline justify-between gap-2 text-left py-1 pl-3 text-[15px] cursor-pointer ${
                  filters.categoryId === cat.id
                    ? 'font-semibold text-slate-900'
                    : 'text-brand-600 hover:text-brand-800 hover:underline underline-offset-2'
                }`}
              >
                <span>{t(`categories.${cat.id}`)}</span>
                <span className="text-xs text-slate-400 tabular-nums font-normal">
                  {categoryCounts[cat.id] || 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Price */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 mb-2">{t('search.price')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            inputMode="numeric"
            value={filters.priceFrom}
            onChange={(e) => onChange({ priceFrom: digitsOnly(e.target.value) })}
            placeholder={t('search.from')}
            aria-label={`${t('search.price')} ${t('search.from')}`}
            className={inputCls}
          />
          <input
            inputMode="numeric"
            value={filters.priceTo}
            onChange={(e) => onChange({ priceTo: digitsOnly(e.target.value) })}
            placeholder={t('search.to')}
            aria-label={`${t('search.price')} ${t('search.to')}`}
            className={inputCls}
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 mb-2">{t('search.city')}</h3>
        <select
          value={filters.locationId}
          onChange={(e) => onChange({ locationId: e.target.value })}
          className={`${inputCls} cursor-pointer`}
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

      {/* Toggles */}
      <div className="flex flex-col gap-2.5">
        <label className="flex items-center gap-2.5 text-[15px] text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.withPhotoOnly}
            onChange={(e) => onChange({ withPhotoOnly: e.target.checked })}
            className="w-5 h-5 rounded accent-brand-500 cursor-pointer"
          />
          {t('search.onlyWithPhoto')}
        </label>
        <label className="flex items-center gap-2.5 text-[15px] text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.negotiableOnly}
            onChange={(e) => onChange({ negotiableOnly: e.target.checked })}
            className="w-5 h-5 rounded accent-brand-500 cursor-pointer"
          />
          {t('feed.negotiableOnly')}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="h-11 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold cursor-pointer"
          >
            {t('search.showResults')} ({resultCount})
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-xl bg-tile hover:bg-tile-hover text-slate-900 text-[15px] font-semibold cursor-pointer"
        >
          {t('feed.resetFilters')}
        </button>
      </div>
    </div>
  );
}
