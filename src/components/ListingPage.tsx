import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  ImageOff,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldAlert
} from 'lucide-react';
import { CategoryId, Listing } from '../types/marketplace';
import { useI18n } from '../contexts/I18nContext';
import { getLocationName } from '../data/locations';
import {
  formatPrice,
  formatRelativeDate,
  getLocalizedDescription,
  getLocalizedTitle,
  getTelHref,
  getWhatsappHref
} from '../utils/format';
import { ListingCard } from './ListingCard';

interface ListingPageProps {
  listing: Listing;
  allListings: Listing[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelect: (listing: Listing) => void;
  onBack: () => void;
  onOpenCategory: (cat: CategoryId) => void;
}

/** Full-page listing view: gallery + description on the left, sticky price/contact column on the right. */
export function ListingPage({
  listing,
  allListings,
  favorites,
  onToggleFavorite,
  onSelect,
  onBack,
  onOpenCategory
}: ListingPageProps) {
  const { lang, t } = useI18n();
  const [photo, setPhoto] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const [phoneShown, setPhoneShown] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [overrideLang, setOverrideLang] = useState<'kg' | 'ru' | null>(null);

  useEffect(() => {
    setPhoto(0);
    setImgErrors({});
    setPhoneShown(false);
    setCopiedShare(false);
    setOverrideLang(null);
    window.scrollTo({ top: 0 });
  }, [listing.id]);

  const images = listing.images;
  // Arrow keys switch photos
  useEffect(() => {
    if (images.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowRight') setPhoto((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setPhoto((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length]);

  const similar = useMemo(
    () =>
      allListings
        .filter((l) => l.id !== listing.id && l.status === 'active' && l.category === listing.category)
        .slice(0, 10),
    [allListings, listing.id, listing.category]
  );

  const displayLang = overrideLang || lang;
  const title = getLocalizedTitle(listing, lang);
  const description = getLocalizedDescription(listing, displayLang);
  const hasBothLanguages = Boolean(listing.descriptionKg && listing.descriptionRu);
  const locationName = getLocationName(listing.locationId, lang);
  const priceText = formatPrice(listing.price, listing.currency, listing.negotiable, t('feed.negotiable'));
  const dateText = formatRelativeDate(listing.createdAt, lang, {
    today: t('feed.today'),
    yesterday: t('feed.yesterday'),
    daysAgo: t('feed.daysAgo')
  });
  const isFavorite = favorites.includes(listing.id);
  const whatsappUrl = getWhatsappHref(listing.phone, `${t('detail.whatsappMessage')} "${title}"`);
  const maskedPhone = listing.phone.replace(/\d{2}-\d{2}$/, 'XX-XX');

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // clipboard may be unavailable
    }
  };

  const phoneButton = phoneShown ? (
    <a
      href={getTelHref(listing.phone)}
      className="w-full h-12 md:h-[52px] rounded-xl bg-go-500 hover:bg-go-600 text-white flex flex-col items-center justify-center leading-tight"
    >
      <span className="text-[16px] font-bold tabular-nums">{listing.phone}</span>
      <span className="text-[12px] opacity-90">{t('detail.call')}</span>
    </a>
  ) : (
    <button
      type="button"
      onClick={() => setPhoneShown(true)}
      className="w-full h-12 md:h-[52px] rounded-xl bg-go-500 hover:bg-go-600 text-white flex flex-col items-center justify-center leading-tight cursor-pointer"
    >
      <span className="text-[15px] font-bold">{t('detail.showPhone')}</span>
      <span className="text-[12px] opacity-90 tabular-nums">{maskedPhone}</span>
    </button>
  );

  const whatsappButton = listing.hasWhatsapp && (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full h-12 md:h-[52px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-bold flex items-center justify-center gap-2"
    >
      <MessageCircle className="w-5 h-5" />
      {t('detail.whatsapp')}
    </a>
  );

  return (
    <div className="pb-24 md:pb-12">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumbs" className="pt-2 md:pt-4 flex items-center gap-1.5 text-[13px] md:text-sm text-slate-500 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button type="button" onClick={onBack} className="flex items-center gap-0.5 text-brand-600 hover:text-rose-600 cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
          {t('nav.home')}
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => onOpenCategory(listing.category)}
          className="text-brand-600 hover:text-rose-600 cursor-pointer"
        >
          {t(`categories.${listing.category}`)}
        </button>
        <span>·</span>
        <span>{locationName}</span>
      </nav>

      {/* Title row */}
      <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-6">
        <h1 className="text-[22px] md:text-[30px] font-bold leading-tight text-slate-900">{title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite(listing.id)}
            aria-pressed={isFavorite}
            className="h-10 px-3.5 rounded-xl bg-tile hover:bg-tile-hover text-[14px] font-medium flex items-center gap-2 cursor-pointer"
          >
            <Heart
              className={`w-4.5 h-4.5 ${isFavorite ? 'text-rose-500' : 'text-slate-700'}`}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
            {isFavorite ? t('detail.inFavorites') : t('detail.toFavorites')}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="h-10 px-3.5 rounded-xl bg-tile hover:bg-tile-hover text-[14px] font-medium flex items-center gap-2 cursor-pointer"
          >
            {copiedShare ? <Check className="w-4.5 h-4.5 text-go-600" /> : <Share2 className="w-4.5 h-4.5" />}
            <span className="hidden sm:inline">{copiedShare ? t('detail.copiedLink') : t('detail.share')}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 md:mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-10">
        {/* Left column */}
        <div className="min-w-0">
          {/* Gallery */}
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-tile">
            {images[photo] && !imgErrors[photo] ? (
              <img
                src={images[photo]}
                alt={`${title} — ${photo + 1}`}
                referrerPolicy="no-referrer"
                onError={() => setImgErrors((p) => ({ ...p, [photo]: true }))}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <ImageOff className="w-12 h-12" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPhoto((i) => (i - 1 + images.length) % images.length)}
                  aria-label="Previous photo"
                  className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-start pl-3 text-white/90 hover:text-white bg-gradient-to-r from-black/20 to-transparent cursor-pointer"
                >
                  <ChevronLeft className="w-8 h-8 drop-shadow" />
                </button>
                <button
                  type="button"
                  onClick={() => setPhoto((i) => (i + 1) % images.length)}
                  aria-label="Next photo"
                  className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-end pr-3 text-white/90 hover:text-white bg-gradient-to-l from-black/20 to-transparent cursor-pointer"
                >
                  <ChevronRight className="w-8 h-8 drop-shadow" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs tabular-nums">
                  {photo + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhoto(idx)}
                  className={`w-[88px] h-[66px] rounded-lg overflow-hidden shrink-0 border-2 cursor-pointer ${
                    idx === photo ? 'border-brand-500' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Mobile: price + contacts right below photos */}
          <div className="lg:hidden mt-4">
            <div className="text-[26px] font-bold tabular-nums">{priceText}</div>
            {listing.negotiable && listing.price !== null && listing.price > 0 && (
              <div className="text-sm text-slate-500">{t('feed.negotiable')}</div>
            )}
          </div>

          {/* Address */}
          <section className="mt-6 md:mt-8">
            <h2 className="text-[20px] md:text-[22px] font-bold mb-2">{t('detail.onMap')}</h2>
            <div className="flex items-center gap-2 text-[15px] text-slate-800">
              <MapPin className="w-4.5 h-4.5 text-slate-500" />
              {locationName}
            </div>
          </section>

          {/* Description */}
          <section className="mt-6 md:mt-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-[20px] md:text-[22px] font-bold">{t('detail.description')}</h2>
              {hasBothLanguages && (
                <div className="flex items-center gap-0.5 p-0.5 bg-tile rounded-lg text-xs">
                  {(['kg', 'ru'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setOverrideLang(code)}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        displayLang === code ? 'bg-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[15px] md:text-[16px] leading-relaxed text-slate-800 whitespace-pre-line">
              {description}
            </p>
          </section>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
            <span>
              {t('detail.adNumber')} {listing.id}
            </span>
            <span>{dateText}</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="w-4 h-4" />
              {listing.views}
            </span>
          </div>
        </div>

        {/* Right column (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[140px] flex flex-col gap-3">
            <div className="text-[30px] font-bold tabular-nums leading-tight">{priceText}</div>
            {listing.negotiable && listing.price !== null && listing.price > 0 && (
              <div className="-mt-2 text-sm text-slate-500">{t('feed.negotiable')}</div>
            )}
            <div className="mt-2 flex flex-col gap-2">
              {phoneButton}
              {whatsappButton}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 font-bold text-xl flex items-center justify-center shrink-0">
                {listing.sellerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-brand-600 truncate">{listing.sellerName}</div>
                <div className="text-[13px] text-slate-500">{t('detail.sellerAds')}</div>
                <div className="text-[13px] text-slate-500">
                  {t('detail.memberSince')} {listing.sellerSince}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-tile flex items-start gap-2.5 text-[13px] text-slate-700 leading-relaxed">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{t('detail.safetyTip')}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile: seller + safety */}
      <div className="lg:hidden mt-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center shrink-0">
          {listing.sellerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold truncate">{listing.sellerName}</div>
          <div className="text-[13px] text-slate-500">
            {t('detail.memberSince')} {listing.sellerSince}
          </div>
        </div>
      </div>
      <div className="lg:hidden mt-4 p-3.5 rounded-xl bg-tile flex items-start gap-2.5 text-[13px] text-slate-700">
        <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
        <span>{t('detail.safetyTip')}</span>
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[20px] md:text-[24px] font-bold mb-4">{t('detail.similar')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 md:gap-x-4 gap-y-6">
            {similar.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                isFavorite={favorites.includes(item.id)}
                onToggleFavorite={onToggleFavorite}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mobile sticky contact bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 p-3 flex gap-2">
        <div className="flex-1">{phoneButton}</div>
        {listing.hasWhatsapp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('detail.whatsapp')}
            className="flex-1 h-12 rounded-xl bg-brand-500 text-white text-[15px] font-bold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </a>
        )}
        {!listing.hasWhatsapp && (
          <a
            href={getTelHref(listing.phone)}
            aria-label={t('detail.call')}
            className="w-12 h-12 rounded-xl bg-tile flex items-center justify-center"
          >
            <Phone className="w-5 h-5" />
          </a>
        )}
      </div>
    </div>
  );
}
