import { Currency, Language, Listing } from '../types/marketplace';

export function formatKyrgyzPhoneInput(raw: string): string {
  // Strip non-digits
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('996')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 9);

  if (digits.length === 0) return '+996 (';
  let result = '+996 (';
  result += digits.slice(0, 3);
  if (digits.length >= 3) {
    result += ') ';
    result += digits.slice(3, 5);
  }
  if (digits.length >= 5) {
    result += '-' + digits.slice(5, 7);
  }
  if (digits.length >= 7) {
    result += '-' + digits.slice(7, 9);
  }
  return result;
}

export function isValidKyrgyzPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('996');
}

export function getCleanPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('996')) return digits;
  if (digits.startsWith('0')) return '996' + digits.slice(1);
  return '996' + digits;
}

export function getTelHref(phone: string): string {
  return `tel:+${getCleanPhoneDigits(phone)}`;
}

export function getWhatsappHref(phone: string, message: string): string {
  const clean = getCleanPhoneDigits(phone);
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function formatPrice(
  price: number | null,
  currency: Currency,
  negotiable: boolean,
  negotiableLabel: string
): string {
  if (price === null || price <= 0) {
    return negotiableLabel;
  }
  const formatted = new Intl.NumberFormat('ru-RU').format(price);
  if (currency === 'USD') {
    return `${formatted} $`;
  }
  return `${formatted} сом`;
}

export function formatRelativeDate(
  isoDate: string,
  lang: Language,
  labels: { today: string; yesterday: string; daysAgo: string }
): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    const timeStr = date.toLocaleTimeString(lang === 'kg' ? 'ky-KG' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${labels.today}, ${timeStr}`;
  }
  if (diffDays === 1) {
    return labels.yesterday;
  }
  if (diffDays < 7) {
    return `${diffDays} ${labels.daysAgo}`;
  }
  return date.toLocaleDateString(lang === 'kg' ? 'ky-KG' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function getLocalizedTitle(listing: Listing, lang: Language): string {
  if (lang === 'ru') {
    return listing.titleRu?.trim() || listing.titleKg;
  }
  return listing.titleKg?.trim() || listing.titleRu || '';
}

export function getLocalizedDescription(listing: Listing, lang: Language): string {
  if (lang === 'ru') {
    return listing.descriptionRu?.trim() || listing.descriptionKg;
  }
  return listing.descriptionKg?.trim() || listing.descriptionRu || '';
}
