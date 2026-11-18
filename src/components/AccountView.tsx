import React, { useState, useRef, useEffect } from 'react';
import {
  ImageOff,
  Phone,
  Sparkles,
  Heart,
  Package,
  LogOut,
  Trash2,
  CheckCircle2,
  Crown,
  ArrowUpCircle,
  Plus
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { Listing, PromoteTier, UserProfile } from '../types/marketplace';
import { formatKyrgyzPhoneInput, isValidKyrgyzPhone, getLocalizedTitle, formatPrice } from '../utils/format';
import { getLocationName } from '../data/locations';
import { ListingCard } from './ListingCard';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AccountViewProps {
  user: UserProfile | null;
  onLogin: (user: UserProfile, serverFavorites: string[], token: string) => void;
  onLogout: () => void;
  activeTab: 'my_ads' | 'favorites' | 'promote';
  onTabChange: (tab: 'my_ads' | 'favorites' | 'promote') => void;
  listings: Listing[];
  ownAdIds: string[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelectListing: (listing: Listing) => void;
  onDeleteListing: (id: string) => void;
  onToggleStatus: (id: string, nextStatus: 'active' | 'sold') => void;
  onPromoteListing: (id: string, tier: PromoteTier) => void;
  onOpenPostAd: () => void;
}

export function AccountView({
  user,
  onLogin,
  onLogout,
  activeTab,
  onTabChange,
  listings,
  ownAdIds,
  favorites,
  onToggleFavorite,
  onSelectListing,
  onDeleteListing,
  onToggleStatus,
  onPromoteListing,
  onOpenPostAd
}: AccountViewProps) {
  const { lang, t } = useI18n();

  const [authMethod, setAuthMethod] = useState<'phone' | 'google'>('phone');
  const [phone, setPhone] = useState('+996 (');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Which sign-in methods the server has configured
  const [authConfig, setAuthConfig] = useState<{ googleClientId: string | null; smsDemo: boolean } | null>(null);
  useEffect(() => {
    if (user) return;
    let active = true;
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (active && cfg) setAuthConfig(cfg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const [promoteFeedback, setPromoteFeedback] = useState<string | null>(null);
  const promoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (promoteTimerRef.current) clearTimeout(promoteTimerRef.current);
    };
  }, []);

  const networkError =
    lang === 'kg' ? 'Тармак катасы. Кайра аракет кылыңыз.' : 'Ошибка сети. Попробуйте ещё раз.';

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAuthError(null);
    if (!isValidKyrgyzPhone(phone)) {
      setAuthError(t('postAd.validationPhone'));
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      if (res.status === 429) {
        setAuthError(
          lang === 'kg'
            ? 'Код жакында эле жөнөтүлгөн. Бир мүнөттөн кийин кайра аракет кылыңыз (күнүнө 5 жолудан ашпайт).'
            : 'Код уже отправлен недавно. Повторите через минуту (не больше 5 раз в день).'
        );
        return;
      }
      if (res.status >= 500) {
        setAuthError(
          lang === 'kg'
            ? 'SMS жөнөтүлгөн жок. Бир аздан кийин кайра аракет кылыңыз.'
            : 'Не удалось отправить SMS. Попробуйте чуть позже.'
        );
        return;
      }
      if (!res.ok) throw new Error('send-otp failed');
      const data = (await res.json()) as { demoCode?: string };
      setDemoCode(data.demoCode || null);
      setOtpCode('');
      setOtpSent(true);
    } catch {
      setAuthError(networkError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setAuthError(lang === 'kg' ? '6 орундуу кодду жазыңыз' : 'Введите 6-значный код');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode })
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        const expired = /expired/i.test(error || '');
        setAuthError(
          expired
            ? lang === 'kg'
              ? 'Коддун мөөнөтү бүттү же аракеттер көп болду. Жаңы код алыңыз.'
              : 'Код истёк или было слишком много попыток. Запросите новый код.'
            : lang === 'kg'
              ? 'Код туура эмес'
              : 'Неверный код'
        );
        return;
      }
      const data = (await res.json()) as { user: UserProfile; favorites: string[]; token: string };
      onLogin(data.user, data.favorites || [], data.token);
    } catch {
      setAuthError(networkError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      if (!res.ok) throw new Error('google auth failed');
      const data = (await res.json()) as { user: UserProfile; favorites: string[]; token: string };
      onLogin(data.user, data.favorites || [], data.token);
    } catch {
      setAuthError(lang === 'kg' ? 'Google аркылуу кирүү ишке ашкан жок' : 'Не удалось войти через Google');
    } finally {
      setAuthLoading(false);
    }
  };

  // Only the signed-in user's ads, plus ads posted from this browser.
  // (Previously every guest ad from any visitor showed up here and could be deleted.)
  const myListings = user
    ? listings.filter((l) => l.sellerId === user.id || ownAdIds.includes(l.id))
    : [];
  const favoriteListings = listings.filter((l) => favorites.includes(l.id));

  const handlePromoteClick = (id: string, tier: PromoteTier) => {
    onPromoteListing(id, tier);
    setPromoteFeedback(t('account.promoteSuccess'));
    if (promoteTimerRef.current) clearTimeout(promoteTimerRef.current);
    promoteTimerRef.current = setTimeout(() => setPromoteFeedback(null), 3000);
  };

  const handleDeleteClick = (id: string) => {
    const question =
      lang === 'kg' ? 'Жарыяны өчүрөсүзбү? Муну кайтаруу мүмкүн эмес.' : 'Удалить объявление? Это действие нельзя отменить.';
    if (window.confirm(question)) onDeleteListing(id);
  };

  // Auth Gate when signed out (except if user opened Favorites tab, show Favorites + Auth banner)
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        {activeTab === 'favorites' && (
          <div className="mb-10">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-4">
              {t('account.tabFavorites')}
            </h1>
            {favoriteListings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                {favoriteListings.map((item) => (
                  <ListingCard
                    key={item.id}
                    listing={item}
                    isFavorite={true}
                    onToggleFavorite={onToggleFavorite}
                    onSelect={onSelectListing}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <Heart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">{t('account.noFavorites')}</p>
                <p className="text-sm text-slate-500 mt-1">{t('account.noFavoritesDesc')}</p>
              </div>
            )}
          </div>
        )}

        <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-7">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {t('account.authTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{t('account.authSubtitle')}</p>

          {/* Segmented Auth Method Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('phone');
                setAuthError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                authMethod === 'phone'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('account.phoneTab')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('google');
                setAuthError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                authMethod === 'google'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('account.googleTab')}
            </button>
          </div>

          {authError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {authError}
            </div>
          )}

          {authMethod === 'phone' ? (
            !otpSent ? (
              <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {t('account.phoneLabel')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatKyrgyzPhoneInput(e.target.value))}
                      placeholder="+996 (700) 12-34-56"
                      className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 tabular-nums focus:outline-none focus:border-brand-600"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[44px] bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('account.sendSms')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
                {demoCode ? (
                  <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    {lang === 'kg'
                      ? 'Демо-режим: SMS азырынча жөнөтүлбөйт. Сиздин код: '
                      : 'Демо-режим: SMS пока не отправляются. Ваш код: '}
                    <b className="tabular-nums tracking-widest">{demoCode}</b>
                  </p>
                ) : (
                  <p className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-xl p-3">
                    {t('account.otpHint')}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {t('account.otpLabel')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-center text-lg font-bold tracking-[0.4em] text-slate-900 tabular-nums focus:outline-none focus:border-brand-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[44px] bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('account.verifyBtn')}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => handleSendOtp()}
                  className="w-full text-xs font-medium text-brand-700 hover:text-brand-800 cursor-pointer py-1"
                >
                  {lang === 'kg' ? 'Кодду кайра жөнөтүү' : 'Отправить код ещё раз'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setDemoCode(null);
                  }}
                  className="w-full text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer py-1"
                >
                  {t('account.changePhone')}
                </button>
              </form>
            )
          ) : (
            <div className="mt-5 space-y-3">
              {authConfig?.googleClientId ? (
                <>
                  <GoogleSignInButton
                    clientId={authConfig.googleClientId}
                    lang={lang}
                    onCredential={handleGoogleCredential}
                    onError={() => setAuthError(networkError)}
                  />
                  {authLoading && (
                    <p className="text-center text-xs text-slate-500">{lang === 'kg' ? 'Текшерилүүдө…' : 'Проверяем…'}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-3.5">
                  {lang === 'kg'
                    ? 'Google аркылуу кирүү жакында иштейт. Азырынча телефон номери менен кириңиз.'
                    : 'Вход через Google скоро заработает. Пока войдите по номеру телефона.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* User Summary Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">{user.name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
              {user.phone || user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenPostAd}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('nav.postAd')}</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('account.logout')}</span>
          </button>
        </div>
      </div>

      {/* 3 Required Account Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => onTabChange('my_ads')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'my_ads'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t('account.tabMyAds')}</span>
          <span className="tabular-nums text-xs text-slate-400">({myListings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('favorites')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'favorites'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>{t('account.tabFavorites')}</span>
          <span className="tabular-nums text-xs text-slate-400">({favoriteListings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('promote')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'promote'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{t('account.tabPromote')}</span>
        </button>
      </div>

      {/* TAB 1: My Ads */}
      {activeTab === 'my_ads' && (
        <div>
          {myListings.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <Package className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <h2 className="text-base font-bold text-slate-900">{t('account.noMyAds')}</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {t('account.noMyAdsDesc')}
              </p>
              <button
                type="button"
                onClick={onOpenPostAd}
                className="mt-4 min-h-[42px] px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('nav.postAd')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myListings.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
                >
                  {item.images[0] ? (
                    <img
                      src={item.images[0]}
                      alt={getLocalizedTitle(item, lang)}
                      onClick={() => onSelectListing(item)}
                      className="w-full sm:w-32 h-28 object-cover rounded-lg bg-slate-100 shrink-0 cursor-pointer"
                    />
                  ) : (
                    <div
                      onClick={() => onSelectListing(item)}
                      className="w-full sm:w-32 h-28 rounded-lg bg-slate-100 shrink-0 cursor-pointer flex items-center justify-center text-slate-400"
                    >
                      <ImageOff className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {formatPrice(item.price, item.currency, item.negotiable, t('feed.negotiable'))}
                        </span>
                        {item.promoteTier !== 'none' && (
                          <span className="text-xs font-bold text-amber-600 uppercase">
                            {item.promoteTier}
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => onSelectListing(item)}
                        className="mt-1 text-sm font-semibold text-slate-800 line-clamp-2 cursor-pointer hover:text-brand-700"
                      >
                        {getLocalizedTitle(item, lang)}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {getLocationName(item.locationId, lang)} · {item.views} {t('feed.views')}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleStatus(item.id, item.status === 'active' ? 'sold' : 'active')
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                        <span>
                          {item.status === 'active'
                            ? t('account.markSold')
                            : t('account.markActive')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('account.deleteAd')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favoriteListings.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <Heart className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <h2 className="text-base font-bold text-slate-900">{t('account.noFavorites')}</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {t('account.noFavoritesDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
              {favoriteListings.map((item) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  isFavorite={true}
                  onToggleFavorite={onToggleFavorite}
                  onSelect={onSelectListing}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Promote (VIP / Top) */}
      {activeTab === 'promote' && (
        <div className="space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-slate-900">{t('account.promoteTitle')}</h2>
            <p className="text-sm text-slate-600 mt-1">{t('account.promoteSubtitle')}</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Crown className="w-4.5 h-4.5 text-amber-500" />
                    {t('account.vipPlan')}
                  </span>
                  <span className="text-sm font-extrabold text-amber-600 tabular-nums">
                    {t('account.vipPrice')}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{t('account.vipPlanDesc')}</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-brand-200">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-brand-600" />
                    {t('account.topPlan')}
                  </span>
                  <span className="text-sm font-extrabold text-brand-700 tabular-nums">
                    {t('account.topPrice')}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{t('account.topPlanDesc')}</p>
              </div>
            </div>
          </div>

          {promoteFeedback && (
            <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-sm font-semibold">
              {promoteFeedback}
            </div>
          )}

          {myListings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-sm font-medium text-slate-600">{t('account.noMyAds')}</p>
              <button
                type="button"
                onClick={onOpenPostAd}
                className="mt-3 min-h-[42px] px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('nav.postAd')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {getLocalizedTitle(item, lang)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {formatPrice(item.price, item.currency, item.negotiable, t('feed.negotiable'))} ·{' '}
                      {getLocationName(item.locationId, lang)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePromoteClick(item.id, 'vip')}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        item.promoteTier === 'vip'
                          ? 'bg-amber-500 text-white'
                          : 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>
                        {item.promoteTier === 'vip'
                          ? t('account.alreadyVip')
                          : t('account.activateVip')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePromoteClick(item.id, 'top')}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        item.promoteTier === 'top'
                          ? 'bg-brand-600 text-white'
                          : 'bg-brand-50 border border-brand-300 text-brand-800 hover:bg-brand-100'
                      }`}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>
                        {item.promoteTier === 'top'
                          ? t('account.alreadyTop')
                          : t('account.activateTop')}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
