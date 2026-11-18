import React, { useState, useEffect, useMemo } from 'react';
import { Crown, RotateCcw, SearchX } from 'lucide-react';
import { useI18n } from './contexts/I18nContext';
import { SEED_LISTINGS } from './data/seedListings';
import { matchesLocationFilter, KYRGYZSTAN_LOCATIONS } from './data/locations';
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
import { SearchAndFilters } from './components/SearchAndFilters';
import { CategoryGrid } from './components/CategoryGrid';
import { ListingCard } from './components/ListingCard';
import { ListingDetailModal } from './components/ListingDetailModal';
import { PostAdModal } from './components/PostAdModal';
import { AccountView } from './components/AccountView';

const USER_STORAGE_KEY = 'tezbazar_user';
const FAVORITES_STORAGE_KEY = 'tezbazar_favorites';

export default function App() {
  const { lang, t } = useI18n();

  const [listings, setListings] = useState<Listing[]>(SEED_LISTINGS);
  const [loadingListings, setLoadingListings] = useState(true);

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [accountTab, setAccountTab] = useState<'my_ads' | 'favorites' | 'promote'>('my_ads');

  // Filters
  const [query, setQuery] = useState('');
  const [locationId, setLocationId] = useState('all');
  const [categoryId, setCategoryId] = useState<CategoryId | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [negotiableOnly, setNegotiableOnly] = useState(false);

  // Modals
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isPostAdOpen, setIsPostAdOpen] = useState(false);

  // User & Favorites
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;
    fetch('/api/listings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { listings?: Listing[] } | null) => {
        if (active && data?.listings && data.listings.length > 0) {
          setListings(data.listings);
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
    const exists = favorites.includes(id);
    const next = exists ? favorites.filter((item) => item !== id) : [...favorites, id];
    persistFavorites(next, user);
  };

  const handleSelectListing = (listing: Listing) => {
    setSelectedListing({ ...listing, views: listing.views + 1 });
    setListings((prev) =>
      prev.map((item) => (item.id === listing.id ? { ...item, views: item.views + 1 } : item))
    );
    fetch(`/api/listings/${listing.id}/view`, { method: 'POST' }).catch(() => {});
  };

  const handleCreatedListing = (created: Listing) => {
    setListings((prev) => [created, ...prev]);
    setCurrentView('home');
    setCategoryId('all');
    setLocationId('all');
    setQuery('');
  };

  const handleDeleteListing = (id: string) => {
    setListings((prev) => prev.filter((item) => item.id !== id));
    fetch(`/api/listings/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleToggleStatus = (id: string, nextStatus: 'active' | 'sold') => {
    setListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );
    fetch(`/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    }).catch(() => {});
  };

  const handlePromoteListing = (id: string, tier: PromoteTier) => {
    setListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, promoteTier: tier } : item))
    );
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
    const mergedFavs = Array.from(new Set([...favorites, ...serverFavorites]));
    persistFavorites(mergedFavs, loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const resetFilters = () => {
    setQuery('');
    setLocationId('all');
    setCategoryId('all');
    setNegotiableOnly(false);
    setSortBy('newest');
  };

  const hasActiveFilters =
    query.trim().length > 0 ||
    locationId !== 'all' ||
    categoryId !== 'all' ||
    negotiableOnly;

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matched = listings.filter((item) => {
      if (item.status !== 'active') return false;
      if (categoryId !== 'all' && item.category !== categoryId) return false;
      if (!matchesLocationFilter(item.locationId, locationId)) return false;
      if (negotiableOnly && !item.negotiable) return false;

      if (q) {
        const haystack = [
          item.titleKg,
          item.titleRu || '',
          item.descriptionKg,
          item.descriptionRu || ''
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Normalize price to KGS (~87 KGS/USD) for sorting comparison
    const toComparablePrice = (l: Listing) => {
      if (l.price === null) return 0;
      return l.currency === 'USD' ? l.price * 87 : l.price;
    };

    return [...matched].sort((a, b) => {
      if (sortBy === 'price_asc') return toComparablePrice(a) - toComparablePrice(b);
      if (sortBy === 'price_desc') return toComparablePrice(b) - toComparablePrice(a);
      if (sortBy === 'views') return b.views - a.views;
      // newest: prioritize 'top' tier within newest feed, then chronological
      if (a.promoteTier === 'top' && b.promoteTier !== 'top') return -1;
      if (b.promoteTier === 'top' && a.promoteTier !== 'top') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [listings, query, categoryId, locationId, negotiableOnly, sortBy]);

  const vipListings = useMemo(
    () => filteredListings.filter((item) => item.promoteTier === 'vip'),
    [filteredListings]
  );

  const regularFeedListings = useMemo(
    () => filteredListings.filter((item) => item.promoteTier !== 'vip'),
    [filteredListings]
  );

  const footerCities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city').slice(0, 7);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 pb-[72px] md:pb-0">
      <Header
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view === 'account' && accountTab === 'favorites') {
            setAccountTab('my_ads');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPostAd={() => setIsPostAdOpen(true)}
        favoritesCount={favorites.length}
        user={user}
        onOpenFavorites={() => {
          setCurrentView('account');
          setAccountTab('favorites');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6">
        {currentView === 'home' ? (
          <>
            <SearchAndFilters
              query={query}
              onQueryChange={setQuery}
              locationId={locationId}
              onLocationChange={setLocationId}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              sortBy={sortBy}
              onSortChange={setSortBy}
              negotiableOnly={negotiableOnly}
              onNegotiableOnlyChange={setNegotiableOnly}
              onSubmitSearch={() => {
                const feedEl = document.getElementById('listings-feed');
                feedEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />

            <CategoryGrid
              selectedCategory={categoryId}
              onSelectCategory={setCategoryId}
              listings={listings}
            />

            {/* VIP Listings Block */}
            {vipListings.length > 0 && (
              <section aria-labelledby="vip-heading" className="py-5">
                <div className="flex items-baseline justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500 shrink-0" />
                    <h2 id="vip-heading" className="text-lg sm:text-xl font-bold text-slate-900">
                      {t('feed.vipTitle')}
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    {t('feed.vipSubtitle')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {vipListings.map((item) => (
                    <ListingCard
                      key={item.id}
                      listing={item}
                      isFavorite={favorites.includes(item.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelect={handleSelectListing}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fresh Listings Feed */}
            <section id="listings-feed" aria-labelledby="fresh-heading" className="py-5 pb-12">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-baseline gap-2.5">
                  <h2 id="fresh-heading" className="text-lg sm:text-xl font-bold text-slate-900">
                    {t('feed.freshTitle')}
                  </h2>
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    {t('feed.resultsCount')}: {filteredListings.length}
                  </span>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer min-h-[36px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('feed.resetFilters')}</span>
                  </button>
                )}
              </div>

              {loadingListings && listings.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-72 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
                    />
                  ))}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="py-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <SearchX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900">{t('feed.emptyTitle')}</h3>
                  <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                    {t('feed.emptySubtitle')}
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 min-h-[42px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
                  >
                    {t('feed.resetFilters')}
                  </button>
                </div>
              ) : (
                regularFeedListings.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    {regularFeedListings.map((item) => (
                      <ListingCard
                        key={item.id}
                        listing={item}
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onSelect={handleSelectListing}
                      />
                    ))}
                  </div>
                )
              )}
            </section>
          </>
        ) : (
          <AccountView
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
            activeTab={accountTab}
            onTabChange={setAccountTab}
            listings={listings}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onSelectListing={handleSelectListing}
            onDeleteListing={handleDeleteListing}
            onToggleStatus={handleToggleStatus}
            onPromoteListing={handlePromoteListing}
            onOpenPostAd={() => setIsPostAdOpen(true)}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-base font-extrabold text-slate-900">{t('brand')}</div>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">
              {t('footer.about')}
            </p>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
              {t('footer.regionsTitle')}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {footerCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    setCurrentView('home');
                    setLocationId(city.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs sm:text-sm text-slate-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  {city.name[lang]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
              {t('footer.categoriesTitle')}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCurrentView('home');
                    setCategoryId(cat.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs sm:text-sm text-slate-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  {t(`categories.${cat.id}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200/80 py-4 px-4 sm:px-6 text-center text-xs text-slate-400">
          {t('footer.copyright')}
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        activeAccountTab={accountTab}
        onNavigateHome={() => {
          setCurrentView('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenFavorites={() => {
          setCurrentView('account');
          setAccountTab('favorites');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPostAd={() => setIsPostAdOpen(true)}
        onOpenAccount={() => {
          setCurrentView('account');
          if (accountTab === 'favorites') setAccountTab('my_ads');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        favoritesCount={favorites.length}
      />

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listing={selectedListing}
        isFavorite={selectedListing ? favorites.includes(selectedListing.id) : false}
        onClose={() => setSelectedListing(null)}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Post Ad Modal */}
      <PostAdModal
        isOpen={isPostAdOpen}
        onClose={() => setIsPostAdOpen(false)}
        user={user}
        onCreated={handleCreatedListing}
      />
    </div>
  );
}
