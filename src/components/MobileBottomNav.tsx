import React from 'react';
import { Home, Heart, PlusCircle, User } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { AppView } from '../types/marketplace';

interface MobileBottomNavProps {
  currentView: AppView;
  activeAccountTab: string;
  onNavigateHome: () => void;
  onOpenFavorites: () => void;
  onOpenPostAd: () => void;
  onOpenAccount: () => void;
  favoritesCount: number;
}

export function MobileBottomNav({
  currentView,
  activeAccountTab,
  onNavigateHome,
  onOpenFavorites,
  onOpenPostAd,
  onOpenAccount,
  favoritesCount
}: MobileBottomNavProps) {
  const { t } = useI18n();

  const isHome = currentView === 'home';
  const isFav = currentView === 'account' && activeAccountTab === 'favorites';
  const isProfile = currentView === 'account' && activeAccountTab !== 'favorites';

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center px-1"
    >
      <button
        type="button"
        onClick={onNavigateHome}
        className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
          isHome ? 'text-emerald-600' : 'text-slate-500'
        }`}
      >
        <Home className="w-5 h-5" strokeWidth={isHome ? 2.4 : 1.8} />
        <span className="text-[11px] font-medium mt-0.5 truncate max-w-[76px]">
          {t('nav.home')}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenFavorites}
        className={`relative flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
          isFav ? 'text-emerald-600' : 'text-slate-500'
        }`}
      >
        <div className="relative">
          <Heart className="w-5 h-5" strokeWidth={isFav ? 2.4 : 1.8} />
          {favoritesCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {favoritesCount}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium mt-0.5 truncate max-w-[76px]">
          {t('nav.favorites')}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenPostAd}
        className="flex flex-col items-center justify-center min-h-[48px] text-emerald-600 cursor-pointer"
      >
        <PlusCircle className="w-6 h-6" strokeWidth={2.2} />
        <span className="text-[11px] font-semibold mt-0.5 truncate max-w-[80px]">
          {t('nav.postAd')}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenAccount}
        className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
          isProfile ? 'text-emerald-600' : 'text-slate-500'
        }`}
      >
        <User className="w-5 h-5" strokeWidth={isProfile ? 2.4 : 1.8} />
        <span className="text-[11px] font-medium mt-0.5 truncate max-w-[76px]">
          {t('nav.account')}
        </span>
      </button>
    </nav>
  );
}
