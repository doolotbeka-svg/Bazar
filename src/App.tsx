import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutGrid, List, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from './contexts/I18nContext';
import { SEED_LISTINGS } from './data/seedListings';
import { matchesLocationFilter, KYRGYZSTAN_LOCATIONS, getLocationName } from './data/locations';
import { MARKETPLACE_CATEGORIES } from './data/categories';
import {
  AppView,
  CategoryId,
  Listing,
  PromoteTier,
  SortOption,
  UserProfile
} from './types/marketplace';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CategoryGrid } from './components/CategoryGrid';
import { ListingCard } from './components/ListingCard';
import { ListingPage } from './components/ListingPage';
import { FiltersSidebar, SearchFilters } from './components/FiltersSidebar';
import { PostAdModal } from './components/PostAdModal';
import { AccountView } from './components/AccountView';

const USER_STORAGE_KEY = 'tezbazar_user';
const FAVORITES_STORAGE_KEY = 'tezbazar_favorites';
const OWN_ADS_STORAGE_KEY = 'tezbazar_own_ads';
const LAYOUT_STORAGE_KEY = 'tezbazar_layout';
const AD_QUERY_PARAM = 'ad';
const USD_TO_KGS = 87;

const EMPTY_FILTERS: SearchFilters = {
  categoryId: 'all',
  locationId: 'all',
  priceFrom: '',
  priceTo: '',
  negotiableOnly: false,
  withPhotoOnly: false
};

function readJsonArray(key: string): string[] {
  try {
    const saved = localStorage.getItem(key);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function urlWithAd(id: string | null): string {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(AD_QUERY_PARAM, id);
  else url.searchParams.delete(AD_QUERY_PARAM);
  return url.toString();
}

const toKgs = (l: Listing) => (l.price === null ? 0 : l.currency === 'USD' ? l.price * USD_TO_KGS : l.price);

export default function App() {
  const { lang, t } = useI18n();

  const [listings, setListings] = useState<Listing[]>(SEED_LISTINGS);
  const [loadingListings, setLoadingListings] = useState(true);
  const listingsRef = useRef(listings);
  listingsRef.current = listings;

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [accountTab, setAccountTab] = useState<'my_ads' | 'favorites' | 'promote'>('my_ads');

  // Search: the header input is applied only on submit
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isPostAdOpen, setIsPostAdOpen] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => readJsonArray(FAVORITES_STORAGE_KEY));
  // IDs of ads posted from this browser (also covers ads posted before signing in)
  const [ownAdIds, setOwnAdIds] = useState<string[]>(() => readJsonArray(OWN_ADS_STORAGE_KEY));

  useEffect(() => {
    let active = true;
    fetch('/api/listings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { listings?: Listing[] } | null) => {
        if (active && data && Array.isArray(data.listings)) {
          const serverListings = data.listings;
          setListings(serverListings);
          // Open a shared ad link (?ad=<id>)
          const sharedId = new URLSearchParams(window.location.search).get(AD_QUERY_PARAM);
          const shared = sharedId ? serverListings.find((l) => l.id === sharedId) : undefined;
          if (shared) setSelectedListing(shared);
        }
      })
      .catch(() => {
        // Keep seeded listings on transient error
      })
      .finally(() => {
        if (active) setLoadingListings(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Browser back/forward between the feed and a listing page
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get(AD_QUERY_PARAM);
      setSelectedListing(id ? listingsRef.current.find((l) => l.id === id) || null : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* ---------------- favorites / own ads ---------------- */

  const persistFavorites = (nextFavs: string[], currentUser: UserProfile | null) => {
    setFavorites(nextFavs);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
    } catch {
      // ignore
    }
    if (currentUser) {
      fetch('/api/favorites/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, favorites: nextFavs })
      }).catch(() => {});
    }
  };

  const handleToggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    persistFavorites(next, user);
  };

  const persistOwnAds = (next: string[]) => {
    setOwnAdIds(next);
    try {
      localStorage.setItem(OWN_ADS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  /* ---------------- navigation ---------------- */

  const closeListingSilently = () => {
    if (!selectedListing) return;
    setSelectedListing(null);
    try {
      window.history.replaceState(null, '', urlWithAd(null));
    } catch {
      // ignore
    }
  };

  const handleSelectListing = (listing: Listing) => {
    setSelectedListing({ ...listing, views: listing.views + 1 });
    try {
      window.history.pushState({ ad: listing.id }, '', urlWithAd(listing.id));
    } catch {
      // ignore
    }
    setListings((prev) =>
      prev.map((item) => (item.id === listing.id ? { ...item, views: item.views + 1 } : item))
    );
    fetch(`/api/listings/${listing.id}/view`, { method: 'POST' }).catch(() => {});
  };

  const handleCloseListing = () => {
    // Opened from the feed -> go back in history; opened from a shared link -> just clear it
    if ((window.history.state as { ad?: string } | null)?.ad) {
      window.history.back();
    } else {
      closeListingSilently();
    }
  };

  const goHome = () => {
    closeListingSilently();
    setCurrentView('home');
    setQueryInput('');
    setQuery('');
    setFilters(EMPTY_FILTERS);
    window.scrollTo({ top: 0 });
  };

  const showResults = () => {
    closeListingSilently();
    setCurrentView('home');
    setQuery(queryInput.trim());
    window.scrollTo({ top: 0 });
  };

  const openCategory = (cat: CategoryId) => {
    closeListingSilently();
    setCurrentView('home');
    setFilters((f) => ({ ...f, categoryId: cat }));
    window.scrollTo({ top: 0 });
  };

  const openAccount = (tab?: 'my_ads' | 'favorites' | 'promote') => {
    closeListingSilently();
    setCurrentView('account');
    if (tab) setAccountTab(tab);
    else if (accountTab === 'favorites') setAccountTab('my_ads');
    window.scrollTo({ top: 0 });
  };

  const changeLayout = (next: 'grid' | 'list') => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  /* ---------------- listing actions ---------------- */

  const handleCreatedListing = (created: Listing) => {
    setListings((prev) => [created, ...prev]);
    persistOwnAds([...ownAdIds, created.id]);
    goHome();
  };

  const handleDeleteListing = (id: string) => {
    setListings((prev) => prev.filter((item) => item.id !== id));
    persistOwnAds(ownAdIds.filter((item) => item !== id));
    if (selectedListing?.id === id) closeListingSilently();
    fetch(`/api/listings/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleToggleStatus = (id: string, nextStatus: 'active' | 'sold') => {
    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    fetch(`/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    }).catch(() => {});
  };

  const handlePromoteListing = (id: string, tier: PromoteTier) => {
    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, promoteTier: tier } : item)));
    fetch(`/api/listings/${id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier })
    }).catch(() => {});
  };

  const handleLogin = (loggedInUser: UserProfile, serverFavorites: string[]) => {
    setUser(loggedInUser);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch {
      // ignore
    }
    persistFavorites(Array.from(new Set([...favorites, ...serverFavorites])), loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  /* ---------------- search ---------------- */

  const isSearching =
    query.length > 0 ||
    filters.categoryId !== 'all' ||
    filters.locationId !== 'all' ||
    filters.priceFrom !== '' ||
    filters.priceTo !== '' ||
    filters.negotiableOnly ||
    filters.withPhotoOnly;

  const activeListings = useMemo(() => listings.filter((l) => l.status === 'active'), [listings]);

  // Matches everything except the category, so the sidebar can show per-category counts
  const matchesNonCategory = useMemo(() => {
    const q = query.toLowerCase();
    const from = filters.priceFrom ? Number(filters.priceFrom) : null;
    const to = filters.priceTo ? Number(filters.priceTo) : null;
    return (item: Listing) => {
      if (!matchesLocationFilter(item.locationId, filters.locationId)) return false;
      if (filters.negotiableOnly && !item.negotiable) return false;
      if (filters.withPhotoOnly && item.images.length === 0) return false;
      if (from !== null || to !== null) {
        if (item.price === null) return false;
        const p = toKgs(item);
        if (from !== null && p < from) return false;
        if (to !== null && p > to) return false;
      }
      if (q) {
        const haystack = [item.titleKg, item.titleRu || '', item.descriptionKg, item.descriptionRu || '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    };
  }, [query, filters.locationId, filters.negotiableOnly, filters.withPhotoOnly, filters.priceFrom, filters.priceTo]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of activeListings) if (matchesNonCategory(l)) counts[l.category] = (counts[l.category] || 0) + 1;
    return counts;
  }, [activeListings, matchesNonCategory]);

  const results = useMemo(() => {
    const matched = activeListings.filter(
      (l) => (filters.categoryId === 'all' || l.category === filters.categoryId) && matchesNonCategory(l)
    );
    const tierRank = (l: Listing) => (l.promoteTier === 'none' ? 0 : 1);
    return matched.sort((a, b) => {
      if (sortBy === 'price_asc') return toKgs(a) - toKgs(b);
      if (sortBy === 'price_desc') return toKgs(b) - toKgs(a);
      if (sortBy === 'views') return b.views - a.views;
      // newest: promoted ads first, then chronological
      if (tierRank(a) !== tierRank(b)) return tierRank(b) - tierRank(a);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeListings, filters.categoryId, matchesNonCategory, sortBy]);

  const vipListings = useMemo(() => activeListings.filter((l) => l.promoteTier === 'vip'), [activeListings]);
  const recommended = useMemo(
    () =>
      [...activeListings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activeListings]
  );

  const searchHeading = [
    filters.categoryId !== 'all' ? t(`categories.${filters.categoryId}`) : t('search.title'),
    filters.locationId !== 'all'
      ? `${t('search.in')} ${getLocationName(filters.locationId, lang)}`.trim()
      : t('search.inAll')
  ].join(' ');

  const footerCities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city').slice(0, 8);

  const renderCards = (items: Listing[], mode: 'grid' | 'list', cols: string) =>
    mode === 'list' ? (
      <div className="flex flex-col">
        {items.map((item) => (
          <ListingCard
            key={item.id}
            listing={item}
            layout="list"
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={handleToggleFavorite}
            onSelect={handleSelectListing}
          />
        ))}
      </div>
    ) : (
      <div className={`grid ${cols} gap-x-3 md:gap-x-4 gap-y-6`}>
        {items.map((item) => (
          <ListingCard
            key={item.id}
            listing={item}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={handleToggleFavorite}
            onSelect={handleSelectListing}
          />
        ))}
      </div>
    );

  const filtersSidebar = (onDone?: () => void) => (
    <FiltersSidebar
      filters={filters}
      onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
      onReset={() => {
        setFilters(EMPTY_FILTERS);
        setQuery('');
        setQueryInput('');
      }}
      categoryCounts={categoryCounts}
      resultCount={results.length}
      onDone={onDone}
    />
  );

  /* ---------------- render ---------------- */

  let page: React.ReactNode;
  if (selectedListing) {
    page = (
      <ListingPage
        listing={selectedListing}
        allListings={listings}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelect={handleSelectListing}
        onBack={handleCloseListing}
        onOpenCategory={openCategory}
      />
    );
  } else if (currentView === 'account') {
    page = (
      <AccountView
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeTab={accountTab}
        onTabChange={setAccountTab}
        listings={listings}
        ownAdIds={ownAdIds}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelectListing={handleSelectListing}
        onDeleteListing={handleDeleteListing}
        onToggleStatus={handleToggleStatus}
        onPromoteListing={handlePromoteListing}
        onOpenPostAd={() => setIsPostAdOpen(true)}
      />
    );
  } else if (!isSearching) {
    page = (
      <>
        <CategoryGrid onSelectCategory={openCategory} />

        {vipListings.length > 0 && (
          <section className="pb-8">
            <h2 className="text-[20px] md:text-[26px] font-bold mb-4">{t('home.vip')}</h2>
            {renderCards(vipListings.slice(0, 5), 'grid', 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}
          </section>
        )}

        <section className="pb-12">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-4">{t('home.recommendations')}</h2>
          {loadingListings && listings.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="aspect-[4/3] rounded-xl bg-tile animate-pulse" />
              ))}
            </div>
          ) : (
            renderCards(recommended, 'grid', 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')
          )}
        </section>
      </>
    );
  } else {
    page = (
      <div className="pt-3 md:pt-6 pb-12">
        <h1 className="text-[22px] md:text-[30px] font-bold leading-tight">
          {query ? `«${query}» — ` : ''}
          {searchHeading}
        </h1>
        <div className="mt-1 text-sm text-slate-500 tabular-nums">
          {t('feed.resultsCount')}: {results.length}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-8">
          <aside className="hidden lg:block">{filtersSidebar()}</aside>

          <div className="min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden h-10 px-3.5 rounded-xl bg-tile text-[14px] font-medium flex items-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4.5 h-4.5" />
                {t('search.filters')}
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label={t('feed.sortLabel')}
                className="h-10 px-3 rounded-xl bg-tile text-[14px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="newest">{t('feed.sortNewest')}</option>
                <option value="price_asc">{t('feed.sortPriceAsc')}</option>
                <option value="price_desc">{t('feed.sortPriceDesc')}</option>
                <option value="views">{t('feed.sortViews')}</option>
              </select>
              <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-tile">
                {(
                  [
                    ['grid', LayoutGrid, t('search.grid')],
                    ['list', List, t('search.list')]
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => changeLayout(mode)}
                    aria-label={label}
                    aria-pressed={layout === mode}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
                      layout === mode ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </button>
                ))}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="py-16 px-6 rounded-2xl bg-tile text-center">
                <SearchX className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-[17px] font-bold">{t('feed.emptyTitle')}</h3>
                <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">{t('feed.emptySubtitle')}</p>
                <button
                  type="button"
                  onClick={goHome}
                  className="mt-4 h-11 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold cursor-pointer"
                >
                  {t('feed.resetFilters')}
                </button>
              </div>
            ) : (
              renderCards(results, layout, 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4')
            )}
          </div>
        </div>

        {/* Mobile filters sheet */}
        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-white overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 h-14 flex items-center justify-between">
              <span className="text-[17px] font-bold">{t('search.filters')}</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label={t('search.hideFilters')}
                className="w-10 h-10 -mr-2 flex items-center justify-center cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">{filtersSidebar(() => setMobileFiltersOpen(false))}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-white text-slate-900 ${selectedListing ? '' : 'pb-[64px] md:pb-0'}`}>
      <Header
        onGoHome={goHome}
        onOpenPostAd={() => setIsPostAdOpen(true)}
        onOpenFavorites={() => openAccount('favorites')}
        onOpenAccount={() => openAccount()}
        favoritesCount={favorites.length}
        user={user}
        query={queryInput}
        onQueryChange={setQueryInput}
        onSubmitSearch={showResults}
        categoryId={filters.categoryId}
        onCategoryChange={(cat) => setFilters((f) => ({ ...f, categoryId: cat }))}
        locationId={filters.locationId}
        onLocationChange={(loc) => setFilters((f) => ({ ...f, locationId: loc }))}
        listings={listings}
      />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-6">{page}</main>

      <footer className="bg-tile mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-display text-[20px] font-extrabold">
              <span className="text-brand-800">Tez</span><span className="text-go-500">Bazar</span>
            </div>
            <p className="mt-2 text-[13px] text-slate-600 leading-relaxed max-w-xs">{t('footer.about')}</p>
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900 mb-2.5">{t('footer.regionsTitle')}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {footerCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    closeListingSilently();
                    setCurrentView('home');
                    setFilters((f) => ({ ...f, locationId: city.id }));
                    window.scrollTo({ top: 0 });
                  }}
                  className="text-[13px] text-slate-600 hover:text-brand-600 cursor-pointer"
                >
                  {city.name[lang]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900 mb-2.5">{t('footer.categoriesTitle')}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openCategory(cat.id)}
                  className="text-[13px] text-slate-600 hover:text-brand-600 cursor-pointer"
                >
                  {t(`categories.${cat.id}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-black/5 py-4 px-4 text-center text-xs text-slate-500">
          {t('footer.copyright')}
        </div>
      </footer>

      {!selectedListing && (
        <MobileBottomNav
          currentView={currentView}
          activeAccountTab={accountTab}
          onNavigateHome={goHome}
          onOpenFavorites={() => openAccount('favorites')}
          onOpenPostAd={() => setIsPostAdOpen(true)}
          onOpenAccount={() => openAccount()}
          favoritesCount={favorites.length}
        />
      )}

      <PostAdModal
        isOpen={isPostAdOpen}
        onClose={() => setIsPostAdOpen(false)}
        user={user}
        onCreated={handleCreatedListing}
      />
    </div>
  );
}
