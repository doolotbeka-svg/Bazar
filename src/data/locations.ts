import { LocationItem } from '../types/marketplace';

export const KYRGYZSTAN_LOCATIONS: LocationItem[] = [
  // Cities (Шаарлар / Города)
  { id: 'bishkek', type: 'city', regionId: 'chuy_region', name: { kg: 'Бишкек', ru: 'Бишкек' } },
  { id: 'osh', type: 'city', regionId: 'osh_region', name: { kg: 'Ош', ru: 'Ош' } },
  { id: 'jalal_abad', type: 'city', regionId: 'jalal_abad_region', name: { kg: 'Жалал-Абад', ru: 'Джалал-Абад' } },
  { id: 'karakol', type: 'city', regionId: 'issyk_kul_region', name: { kg: 'Каракол', ru: 'Каракол' } },
  { id: 'tokmok', type: 'city', regionId: 'chuy_region', name: { kg: 'Токмок', ru: 'Токмок' } },
  { id: 'uzgen', type: 'city', regionId: 'osh_region', name: { kg: 'Өзгөн', ru: 'Узген' } },
  { id: 'balykchy', type: 'city', regionId: 'issyk_kul_region', name: { kg: 'Балыкчы', ru: 'Балыкчы' } },
  { id: 'kara_balta', type: 'city', regionId: 'chuy_region', name: { kg: 'Кара-Балта', ru: 'Кара-Балта' } },
  { id: 'naryn', type: 'city', regionId: 'naryn_region', name: { kg: 'Нарын', ru: 'Нарын' } },
  { id: 'talas', type: 'city', regionId: 'talas_region', name: { kg: 'Талас', ru: 'Талас' } },
  { id: 'batken', type: 'city', regionId: 'batken_region', name: { kg: 'Баткен', ru: 'Баткен' } },
  { id: 'kyzyl_kiya', type: 'city', regionId: 'batken_region', name: { kg: 'Кызыл-Кыя', ru: 'Кызыл-Кия' } },
  { id: 'cholpon_ata', type: 'city', regionId: 'issyk_kul_region', name: { kg: 'Чолпон-Ата', ru: 'Чолпон-Ата' } },
  { id: 'kadamjay', type: 'city', regionId: 'batken_region', name: { kg: 'Кадамжай', ru: 'Кадамжай' } },

  // All 7 Regions (7 облус / 7 областей)
  { id: 'chuy_region', type: 'region', name: { kg: 'Чүй облусу', ru: 'Чуйская область' } },
  { id: 'osh_region', type: 'region', name: { kg: 'Ош облусу', ru: 'Ошская область' } },
  { id: 'jalal_abad_region', type: 'region', name: { kg: 'Жалал-Абад облусу', ru: 'Джалал-Абадская область' } },
  { id: 'issyk_kul_region', type: 'region', name: { kg: 'Ысык-Көл облусу', ru: 'Иссык-Кульская область' } },
  { id: 'naryn_region', type: 'region', name: { kg: 'Нарын облусу', ru: 'Нарынская область' } },
  { id: 'talas_region', type: 'region', name: { kg: 'Талас облусу', ru: 'Таласская область' } },
  { id: 'batken_region', type: 'region', name: { kg: 'Баткен облусу', ru: 'Баткенская область' } }
];

export function getLocationName(locationId: string, lang: 'kg' | 'ru'): string {
  const found = KYRGYZSTAN_LOCATIONS.find((l) => l.id === locationId);
  return found ? found.name[lang] : locationId;
}

export function matchesLocationFilter(listingLocationId: string, filterLocationId: string): boolean {
  if (!filterLocationId || filterLocationId === 'all') return true;
  if (listingLocationId === filterLocationId) return true;
  const listingLoc = KYRGYZSTAN_LOCATIONS.find((l) => l.id === listingLocationId);
  if (listingLoc?.regionId === filterLocationId) return true;
  return false;
}
