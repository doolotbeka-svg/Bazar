import React, { useState } from 'react';
import { Heart, ImageOff } from 'lucide-react';
import { Listing } from '../types/marketplace';
import { useI18n } from '../contexts/I18nContext';
import { getLocationName } from '../data/locations';
import {
  formatPrice,
  formatRelativeDate,
  getLocalizedDescription,
  getLocalizedTitle
} from '../utils/format';

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelect: (listing: Listing) => void;
  layout?: 'grid' | 'list';
}

export function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  onSelect,
  layout = 'grid'
}: ListingCardProps) {
  const { lang, t } = useI18n();
  const [imgError, setImgError] = useState(false);

  const title = getLocalizedTitle(listing, lang);
  const locationName = getLocationName(listing.locationId, lang);
  const priceText = formatPrice(listing.price, listing.currency, listing.negotiable, t('feed.negotiable'));
  const dateText = formatRelativeDate(listing.createdAt, lang, {
    today: t('feed.today'),
    yesterday: t('feed.yesterday'),
    daysAgo: t('feed.daysAgo')
  });
  const cover = listing.images[0];
  const isList = layout === 'list';

  const open = () => onSelect(listing);
  const href = `?ad=${encodeURIComponent(listing.id)}`;
  // Keep normal link behaviour (new tab, copy link) but open in-app on plain click
  const onLinkClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open();
  };

  const image = (
    <div
      className={`relative overflow-hidden rounded-xl bg-tile ${
        isList ? 'w-[132px] sm:w-[240px] aspect-[4/3] shrink-0' : 'aspect-[4/3] w-full'
      }`}
    >
      {cover && !imgError ? (
        <img
          src={cover}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <ImageOff className="w-8 h-8" />
        </div>
      )}

      {listing.promoteTier !== 'none' && listing.status === 'active' && (
        <span
          className={`absolute top-2 left-2 px-1.5 py-0.5 text-[11px] font-bold rounded ${
            listing.promoteTier === 'vip' ? 'bg-amber-400 text-slate-900' : 'bg-brand-500 text-white'
          }`}
        >
          {listing.promoteTier === 'vip' ? t('feed.vipBadge') : t('feed.topBadge')}
        </span>
      )}

      {listing.status === 'sold' && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <span className="px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded">
            {t('feed.soldBadge')}
          </span>
        </div>
      )}
    </div>
  );

  const favButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite(listing.id);
      }}
      aria-label={isFavorite ? t('detail.inFavorites') : t('detail.addToFavorites')}
      aria-pressed={isFavorite}
      className={`shrink-0 w-8 h-8 -mr-1.5 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
        isFavorite ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
      }`}
    >
      <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
  );

  if (isList) {
    return (
      <article className="group flex gap-3 sm:gap-5 py-4 border-b border-slate-100">
        <a href={href} onClick={onLinkClick} className="block">
          {image}
        </a>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-2">
            <a
              href={href}
              onClick={onLinkClick}
              className="flex-1 text-[15px] sm:text-[17px] font-medium text-brand-600 group-hover:text-rose-600 leading-snug line-clamp-2"
            >
              {title}
            </a>
            {favButton}
          </div>
          <div className="mt-1 text-[16px] sm:text-[18px] font-bold text-slate-900 tabular-nums">
            {priceText}
          </div>
          <p className="hidden sm:block mt-2 text-sm text-slate-600 line-clamp-2">
            {getLocalizedDescription(listing, lang)}
          </p>
          <div className="mt-auto pt-2 text-[13px] text-slate-500">
            <div className="truncate">{locationName}</div>
            <div>{dateText}</div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col min-w-0">
      <a href={href} onClick={onLinkClick} className="block">
        {image}
      </a>
      <div className="pt-2 flex items-start gap-1">
        <a
          href={href}
          onClick={onLinkClick}
          className="flex-1 min-w-0 text-[14px] md:text-[15px] text-brand-600 group-hover:text-rose-600 leading-snug line-clamp-2"
        >
          {title}
        </a>
        {favButton}
      </div>
      <div className="mt-0.5 text-[15px] md:text-[16px] font-bold text-slate-900 tabular-nums">
        {priceText}
      </div>
      <div className="mt-1 text-[12px] md:text-[13px] text-slate-500 leading-snug">
        <div className="truncate">{locationName}</div>
        <div>{dateText}</div>
      </div>
    </article>
  );
}
