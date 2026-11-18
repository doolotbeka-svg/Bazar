import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Phone,
  MessageCircle,
  MapPin,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldAlert,
  ImageOff,
  Share2
} from 'lucide-react';
import { Listing } from '../types/marketplace';
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

interface ListingDetailModalProps {
  listing: Listing | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
}

export function ListingDetailModal({
  listing,
  isFavorite,
  onClose,
  onToggleFavorite
}: ListingDetailModalProps) {
  const { lang, t } = useI18n();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const [overrideLang, setOverrideLang] = useState<'kg' | 'ru' | null>(null);

  useEffect(() => {
    setActivePhotoIndex(0);
    setCopiedPhone(false);
    setCopiedShare(false);
    setImgErrors({});
    setOverrideLang(null);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [listing, onClose]);

  if (!listing) return null;

  const displayLang = overrideLang || lang;
  const title = getLocalizedTitle(listing, displayLang);
  const description = getLocalizedDescription(listing, displayLang);
  const hasBothLanguages = Boolean(listing.titleKg && listing.titleRu);

  const locationName = getLocationName(listing.locationId, lang);
  const priceText = formatPrice(
    listing.price,
    listing.currency,
    listing.negotiable,
    t('feed.negotiable')
  );
  const dateText = formatRelativeDate(listing.createdAt, lang, {
    today: t('feed.today'),
    yesterday: t('feed.yesterday'),
    daysAgo: t('feed.daysAgo')
  });

  const images = listing.images.length > 0 ? listing.images : [];
  const currentImg = images[activePhotoIndex];

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(listing.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // ignore
    }
  };

  const whatsappUrl = getWhatsappHref(
    listing.phone,
    `${t('detail.whatsappMessage')} "${title}"`
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl max-h-[94vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar inside modal */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 truncate">
            <span className="font-medium text-slate-700">{t(`categories.${listing.category}`)}</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{locationName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="min-h-[40px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('detail.copiedLink')}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('detail.share')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('detail.back')}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
            {/* Left: Photo Gallery */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="relative aspect-[4/3] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200/70">
                {currentImg && !imgErrors[activePhotoIndex] ? (
                  <img
                    src={currentImg}
                    alt={`${title} — ${activePhotoIndex + 1}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setImgErrors((prev) => ({ ...prev, [activePhotoIndex]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6">
                    <ImageOff className="w-10 h-10 mb-2" />
                    <span className="text-sm text-slate-500 text-center">{title}</span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((i) => (i - 1 + images.length) % images.length)
                      }
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((i) => (i + 1) % images.length)}
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-slate-900/75 text-white text-xs font-medium tabular-nums">
                      {activePhotoIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {images.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        idx === activePhotoIndex
                          ? 'border-emerald-600'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Description section on desktop & mobile */}
              <div className="mt-2 pt-4 border-t border-slate-200/80">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <h3 className="text-base font-bold text-slate-900">{t('detail.description')}</h3>
                  {hasBothLanguages && (
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setOverrideLang('kg')}
                        className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                          displayLang === 'kg'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        KG
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideLang('ru')}
                        className={`px-2 py-1 rounded font-semibold cursor-pointer ${
                          displayLang === 'ru'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        RU
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              </div>
            </div>

            {/* Right: Contiguous Purchase / Contact Module */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                      {priceText}
                    </span>
                    {listing.negotiable && listing.price !== null && listing.price > 0 && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {t('feed.negotiable')}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                    {title}
                  </h2>

                  {/* Unboxed Metadata */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {locationName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {dateText}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      {listing.views} {t('feed.views')}
                    </span>
                  </div>
                </div>

                {/* Primary Contact Buttons */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200/80">
                  <a
                    href={getTelHref(listing.phone)}
                    onClick={handleCopyPhone}
                    className="w-full min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Phone className="w-4.5 h-4.5" />
                    <span>{t('detail.call')}</span>
                    <span className="tabular-nums font-normal text-slate-300">
                      {listing.phone}
                    </span>
                  </a>
                  {copiedPhone && (
                    <span className="text-xs text-emerald-700 font-medium text-center">
                      {t('detail.copiedPhone')}
                    </span>
                  )}

                  {listing.hasWhatsapp && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[48px] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle className="w-4.5 h-4.5" />
                      <span>{t('detail.whatsapp')}</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(listing.id)}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isFavorite
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
                    <span>
                      {isFavorite ? t('detail.inFavorites') : t('detail.addToFavorites')}
                    </span>
                  </button>
                </div>

                {/* Seller Card */}
                <div className="pt-3 border-t border-slate-200/80 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-base shrink-0">
                    {listing.sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {listing.sellerName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('detail.memberSince')} {listing.sellerSince}
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{t('detail.safetyTip')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
