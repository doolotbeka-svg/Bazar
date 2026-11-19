export type Language = 'kg' | 'ru';

export type CategoryId =
  | 'transport'
  | 'real_estate'
  | 'electronics'
  | 'home_garden'
  | 'jobs'
  | 'services'
  | 'personal'
  | 'animals';

export type Currency = 'KGS' | 'USD';

export type PromoteTier = 'none' | 'vip' | 'top';

/** 'blocked' = hidden by a moderator; only admins see it. */
export type ListingStatus = 'active' | 'sold' | 'blocked';

export interface LocationItem {
  id: string;
  type: 'city' | 'region';
  regionId?: string;
  name: {
    kg: string;
    ru: string;
  };
}

export interface CategoryItem {
  id: CategoryId;
  icon: string;
}

export interface Listing {
  id: string;
  category: CategoryId;
  titleKg: string;
  titleRu?: string;
  descriptionKg: string;
  descriptionRu?: string;
  price: number | null;
  currency: Currency;
  negotiable: boolean;
  locationId: string;
  images: string[];
  phone: string;
  hasWhatsapp: boolean;
  sellerName: string;
  sellerId: string;
  sellerSince: string;
  createdAt: string;
  views: number;
  promoteTier: PromoteTier;
  status: ListingStatus;
}

export interface UserProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  authMethod: 'phone' | 'google' | 'telegram';
  joinedAt: string;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'views';
export type AppView = 'home' | 'account';
