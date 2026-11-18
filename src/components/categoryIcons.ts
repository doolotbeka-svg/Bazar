import type { ComponentType } from 'react';
import { Briefcase, Building2, Car, PawPrint, Shirt, Smartphone, Sofa, Wrench } from 'lucide-react';
import type { CategoryId } from '../types/marketplace';

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

export const CATEGORY_ICONS: Record<CategoryId, IconType> = {
  transport: Car,
  real_estate: Building2,
  electronics: Smartphone,
  home_garden: Sofa,
  jobs: Briefcase,
  services: Wrench,
  personal: Shirt,
  animals: PawPrint
};

/** Accent colour of the illustration blob on each category tile. */
export const CATEGORY_ACCENTS: Record<CategoryId, string> = {
  transport: 'bg-cyan-200 text-cyan-800',
  real_estate: 'bg-amber-200 text-amber-700',
  electronics: 'bg-violet-200 text-violet-700',
  home_garden: 'bg-lime-200 text-lime-700',
  jobs: 'bg-orange-200 text-orange-700',
  services: 'bg-teal-200 text-teal-700',
  personal: 'bg-pink-200 text-pink-700',
  animals: 'bg-yellow-200 text-yellow-700'
};
