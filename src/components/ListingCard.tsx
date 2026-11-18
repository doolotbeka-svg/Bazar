import React, { useState } from 'react';
import { Heart, ImageOff, Eye } from 'lucide-react';
import { Listing } from '../types/marketplace';
import { useI18n } from '../contexts/I18nContext';
import { getLocationName } from '../data/locations';
import { formatPrice, formatRelativeDate, getLocalizedTitle } from '../utils/format';

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelect: (listing: Listing) => void;
}

export function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  onSelect
}: ListingCardProps) {
  const { lang, t } = useI18n();
  const [imgError, setImgError] = useState(false);

  const title = getLocalizedTitle(listing, lang);
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

  const coverImage = listing.images[0];

  return (
    <article
      className={`group relative flex flex-col rounded-xl border transition-all duration-150 overflow-hidden bg-slate-50/70 hover:bg-white hover:-translate-y-0.5 hover:shadow-md ${
        listing.promoteTier === 'vip'
          ? 'border-amber-300/90'
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Image area (4:3) */}
      <div
        onClick={() => onSelect(listing)}
        className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden cursor-pointer"
      >
        {coverImage && !imgError ? (
          <img
            src={coverImage}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center">
            <ImageOff className="w-7 h-7 mb-1.5" />
            <span className="text-xs font-medium line-clamp-2 text-slate-500">{title}</span>
          </div>
        )}

        {/* Single subtle promotion marker if VIP / TOP (max 1 tag) */}
        {listing.promoteTier !== 'none' && listing.status === 'active' && (
          <span
            className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[11px] font-bold tracking-wide rounded-md shadow-xs ${
              listing.promoteTier === 'vip'
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {listing.promoteTier === 'vip' ? t('feed.vipBadge') : t('feed.topBadge')}
          </span>
        )}

        {listing.status === 'sold' && (
          <div className="absolute inset-0 bg-slate-900/55 flex items-center justify-center">
            <span className="px-3 py-1 bg-white text-slate-900 text-xs font-bold rounded-md">
              {t('feed.soldBadge')}
            </span>
          </div>
        )}

        {/* Favorite Heart button with >= 44x44px touch target */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(listing.id);
          }}
          aria-label={isFavorite ? t('detail.inFavorites') : t('detail.addToFavorites')}
          className="absolute top-1 right-1 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
        >
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-xs ${
              isFavorite
                ? 'bg-rose-500 text-white'
                : 'bg-white/90 text-slate-600 hover:text-rose-500'
            }`}
          >
            <Heart className="w-4.5 h-4.5" fill={isFavorite ? 'currentColor' : 'none'} />
          </span>
        </button>
      </div>

      {/* Card body */}
      <div
        onClick={() => onSelect(listing)}
        className="flex flex-col flex-1 p-3.5 cursor-pointer"
      >
        {/* Price row */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums tracking-tight">
            {priceText}
          </span>
          {listing.negotiable && listing.price !== null && listing.price > 0 && (
            <span className="text-[11px] font-medium text-emerald-700 whitespace-nowrap shrink-0">
              {t('feed.negotiable')}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mt-1 text-sm font-medium text-slate-800 leading-snug line-clamp-2 min-h-[2.5rem]">
          {title}
        </h3>

        {/* Unboxed clean metadata footer */}
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-medium text-slate-600 truncate">{locationName}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{dateText}</span>
          </div>
          <span className="inline-flex items-center gap-1 tabular-nums shrink-0 text-slate-400">
            <Eye className="w-3.5 h-3.5" />
            {listing.views}
          </span>
        </div>
      </div>
    </article>
  );
}
