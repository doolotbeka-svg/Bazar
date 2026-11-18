import React from 'react';
import {
  Car,
  Building2,
  Smartphone,
  Sofa,
  Briefcase,
  Wrench,
  Shirt,
  PawPrint,
  LayoutGrid
} from 'lucide-react';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { useI18n } from '../contexts/I18nContext';
import { CategoryId, Listing } from '../types/marketplace';

interface CategoryGridProps {
  selectedCategory: CategoryId | 'all';
  onSelectCategory: (cat: CategoryId | 'all') => void;
  listings: Listing[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Car,
  Building2,
  Smartphone,
  Sofa,
  Briefcase,
  Wrench,
  Shirt,
  PawPrint
};

export function CategoryGrid({
  selectedCategory,
  onSelectCategory,
  listings
}: CategoryGridProps) {
  const { t } = useI18n();

  const getCategoryCount = (catId: CategoryId) =>
    listings.filter((l) => l.status === 'active' && l.category === catId).length;

  return (
    <section aria-labelledby="categories-heading" className="py-5">
      <div className="flex items-center justify-between mb-3.5">
        <h2 id="categories-heading" className="text-lg sm:text-xl font-bold text-slate-900">
          {t('categories.title')}
        </h2>
        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1.5 min-h-[36px]"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>{t('categories.all')}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {MARKETPLACE_CATEGORIES.map((cat) => {
          const IconComponent = ICON_MAP[cat.icon] || LayoutGrid;
          const isActive = selectedCategory === cat.id;
          const count = getCategoryCount(cat.id);

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isActive ? 'all' : cat.id)}
              className={`group flex flex-col items-start justify-between p-3.5 rounded-xl border text-left transition-all duration-150 min-h-[92px] cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 text-slate-800'
              }`}
            >
              <div className="w-full flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white border border-slate-200/80 text-emerald-700 group-hover:border-emerald-300'
                  }`}
                >
                  <IconComponent className="w-4.5 h-4.5" />
                </div>
                <span
                  className={`text-xs font-medium tabular-nums ${
                    isActive ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </div>
              <span className="mt-2.5 text-xs sm:text-[13px] font-semibold leading-snug line-clamp-2">
                {t(`categories.${cat.id}`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
