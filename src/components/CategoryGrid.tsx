import React from 'react';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { useI18n } from '../contexts/I18nContext';
import { CategoryId } from '../types/marketplace';
import { CATEGORY_ACCENTS, CATEGORY_ICONS } from './categoryIcons';

interface CategoryGridProps {
  onSelectCategory: (cat: CategoryId) => void;
}

/** Home page category tiles: label top-left, illustration bottom-right. */
export function CategoryGrid({ onSelectCategory }: CategoryGridProps) {
  const { t } = useI18n();

  return (
    <section aria-label={t('categories.title')} className="pt-2 pb-6 md:pt-6 md:pb-8">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
        {MARKETPLACE_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="group relative overflow-hidden flex flex-col items-start justify-start h-[84px] md:h-[104px] rounded-xl md:rounded-2xl bg-tile hover:bg-tile-hover text-left p-2.5 md:p-3 cursor-pointer transition-colors"
            >
              <span className="relative z-10 block text-[12px] md:text-[14px] font-semibold leading-tight text-slate-900 line-clamp-2 pr-1 hyphens-auto">
                {t(`categories.${cat.id}`)}
              </span>
              <span
                className={`absolute -right-3 -bottom-3 w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${CATEGORY_ACCENTS[cat.id]}`}
                aria-hidden="true"
              >
                <Icon className="w-6 h-6 md:w-8 md:h-8 -translate-x-1 -translate-y-1" strokeWidth={1.8} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
