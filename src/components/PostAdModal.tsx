import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Car,
  Building2,
  Smartphone,
  Sofa,
  Briefcase,
  Wrench,
  Shirt,
  PawPrint
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { KYRGYZSTAN_LOCATIONS } from '../data/locations';
import { CategoryId, Currency, Listing, UserProfile } from '../types/marketplace';
import { formatKyrgyzPhoneInput, isValidKyrgyzPhone } from '../utils/format';

interface PostAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onCreated: (listing: Listing) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Car,
  Building2,
  Smartphone,
  Sofa,
  Briefcase,
  Wrench,
  Shirt,
  PawPrint
};

// Each photo is sent as a base64 data URL; 10 photos must fit into one request
// (Vercel limit ~4.5 MB), so every photo is squeezed under this many characters.
const MAX_PHOTO_DATA_URL_CHARS = 300_000;
const MAX_PHOTO_SIDE = 1280;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unsupported image'));
    };
    img.src = url;
  });
}

/** Resize to at most 1280px and re-encode as JPEG, lowering quality/size until it fits the budget. */
async function compressImageToDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  let side = MAX_PHOTO_SIDE;
  let quality = 0.82;
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    // JPEG has no transparency: paint white so transparent PNGs don't turn black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_PHOTO_DATA_URL_CHARS) return dataUrl;
    // Too big: first drop quality, then shrink dimensions
    if (quality > 0.62) quality -= 0.1;
    else side = Math.round(side * 0.8);
  }
  throw new Error('Image too large');
}

export function PostAdModal({ isOpen, onClose, user, onCreated }: PostAdModalProps) {
  const { lang, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const [bilingual, setBilingual] = useState(false);
  const [titleKg, setTitleKg] = useState('');
  const [descKg, setDescKg] = useState('');
  const [titleRu, setTitleRu] = useState('');
  const [descRu, setDescRu] = useState('');

  const [priceStr, setPriceStr] = useState('');
  const [currency, setCurrency] = useState<Currency>('KGS');
  const [negotiable, setNegotiable] = useState(false);
  const [locationId, setLocationId] = useState('bishkek');
  const [phone, setPhone] = useState(user?.phone || '+996 (');
  const [hasWhatsapp, setHasWhatsapp] = useState(true);
  const [sellerName, setSellerName] = useState(user?.name || '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The modal stays mounted while closed, so initial useState values are captured
  // only once. Prefill contact fields from the current user every time it opens.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (user?.phone) {
      setPhone((prev) => (isValidKyrgyzPhone(prev) ? prev : user.phone!));
    }
    if (user?.name) {
      setSellerName((prev) => prev.trim() || user.name);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const cities = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'city');
  const regions = KYRGYZSTAN_LOCATIONS.filter((l) => l.type === 'region');
  const supportsUsd = category === 'transport' || category === 'real_estate';

  const handleSelectCategory = (cat: CategoryId) => {
    setCategory(cat);
    if (cat !== 'transport' && cat !== 'real_estate') {
      setCurrency('KGS');
    }
    setError(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = Array.from(input.files || []).filter((f) => f.type.startsWith('image/'));
    input.value = '';
    if (files.length === 0) return;
    const remaining = 10 - images.length;
    const slice = files.slice(0, remaining);
    // A single broken/unsupported file must not reject the whole batch
    const results = await Promise.allSettled(slice.map((f) => compressImageToDataUrl(f)));
    const compressed = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    if (compressed.length < slice.length) {
      setError(lang === 'kg' ? 'Айрым сүрөттөр жүктөлгөн жок' : 'Некоторые фото не удалось загрузить');
    }
    setImages((prev) => [...prev, ...compressed].slice(0, 10));
  };

  const removePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const goToNext = () => {
    setError(null);
    if (step === 1) {
      if (!category) {
        setError(t('postAd.validationCategory'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const hasAnyTitle = titleKg.trim().length > 0 || titleRu.trim().length > 0;
      if (!hasAnyTitle) {
        setError(t('postAd.validationTitle'));
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pressing Enter inside an input on steps 1-2 triggers implicit form submit.
    // Treat it as "Next" instead of trying to publish a half-filled ad.
    if (step < 3) {
      goToNext();
      return;
    }
    if (submitting) return;
    setError(null);
    const parsedPrice = priceStr.trim() ? Number(priceStr.replace(/\s+/g, '')) : NaN;
    const numericPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;
    if (!negotiable && numericPrice === null) {
      setError(t('postAd.validationPrice'));
      return;
    }
    if (!isValidKyrgyzPhone(phone)) {
      setError(t('postAd.validationPhone'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category,
        titleKg: titleKg.trim() || titleRu.trim(),
        titleRu: titleRu.trim() || undefined,
        descriptionKg: descKg.trim() || descRu.trim() || titleKg.trim() || titleRu.trim(),
        descriptionRu: descRu.trim() || undefined,
        price: numericPrice,
        currency: supportsUsd ? currency : 'KGS',
        negotiable,
        locationId,
        images,
        phone,
        hasWhatsapp,
        sellerName: sellerName.trim() || user?.name || 'Сатуучу',
        sellerId: user?.id || 'guest',
        sellerSince: user?.joinedAt || String(new Date().getFullYear())
      };

      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Failed to create listing');
      }
      const data = (await res.json()) as { listing: Listing };
      onCreated(data.listing);
      // Reset state
      setStep(1);
      setCategory(null);
      setImages([]);
      setTitleKg('');
      setDescKg('');
      setTitleRu('');
      setDescRu('');
      setPriceStr('');
      setNegotiable(false);
      onClose();
    } catch {
      setError(
        lang === 'kg'
          ? 'Сервер катасы. Кайра аракет кылыңыз.'
          : 'Ошибка сервера. Попробуйте ещё раз.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('postAd.title')}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[94vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              {t('postAd.title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 1 && t('postAd.step1')}
              {step === 2 && t('postAd.step2')}
              {step === 3 && t('postAd.step3')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-1 px-5 pt-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-colors ${
                s <= step ? 'bg-brand-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          {/* STEP 1: Category + Photos */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">
                  {t('postAd.chooseCategory')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MARKETPLACE_CATEGORIES.map((cat) => {
                    const IconComponent = ICON_MAP[cat.icon] || Car;
                    const active = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all min-h-[84px] cursor-pointer ${
                          active
                            ? 'bg-brand-600 border-brand-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <IconComponent
                          className={`w-5 h-5 ${active ? 'text-white' : 'text-brand-700'}`}
                        />
                        <span className="text-xs font-semibold leading-snug">
                          {t(`categories.${cat.id}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-bold text-slate-900">
                    {t('postAd.uploadPhotos')}
                  </label>
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    {images.length} / 10
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{t('postAd.uploadHint')}</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {images.length < 10 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-600 bg-slate-50 hover:bg-brand-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-600 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[11px] font-semibold text-center px-1">
                        {t('postAd.addPhotoBtn')}
                      </span>
                    </button>
                  )}

                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/75 text-white text-[10px] font-semibold rounded">
                          {t('postAd.coverLabel')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        aria-label="Remove photo"
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Title & Description (1 or 2 languages) */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {t('postAd.bilingualMode')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('postAd.singleLangHint')}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={bilingual}
                  onChange={(e) => setBilingual(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600 cursor-pointer shrink-0"
                />
              </div>

              {(bilingual || lang === 'kg') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      {t('postAd.titleKg')}
                    </label>
                    <input
                      type="text"
                      value={titleKg}
                      onChange={(e) => setTitleKg(e.target.value)}
                      maxLength={120}
                      placeholder={t('postAd.titleKgPlaceholder')}
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      {t('postAd.descKg')}
                    </label>
                    <textarea
                      value={descKg}
                      onChange={(e) => setDescKg(e.target.value)}
                      rows={4}
                      maxLength={2500}
                      placeholder={t('postAd.descKgPlaceholder')}
                      className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600 resize-none"
                    />
                  </div>
                </div>
              )}

              {(bilingual || lang === 'ru') && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      {t('postAd.titleRu')}
                    </label>
                    <input
                      type="text"
                      value={titleRu}
                      onChange={(e) => setTitleRu(e.target.value)}
                      maxLength={120}
                      placeholder={t('postAd.titleRuPlaceholder')}
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      {t('postAd.descRu')}
                    </label>
                    <textarea
                      value={descRu}
                      onChange={(e) => setDescRu(e.target.value)}
                      rows={4}
                      maxLength={2500}
                      placeholder={t('postAd.descRuPlaceholder')}
                      className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Price, Currency, Location, Phone */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className={supportsUsd ? 'sm:col-span-7' : 'sm:col-span-12'}>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {t('postAd.priceLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    placeholder="0"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 tabular-nums focus:outline-none focus:border-brand-600"
                  />
                </div>

                {supportsUsd && (
                  <div className="sm:col-span-5">
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      {t('postAd.currencyLabel')}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl h-11">
                      <button
                        type="button"
                        onClick={() => setCurrency('KGS')}
                        className={`rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          currency === 'KGS'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        сом (KGS)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          currency === 'USD'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        $ (USD)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {supportsUsd && (
                <p className="text-xs text-slate-500">{t('postAd.currencyHint')}</p>
              )}

              <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={negotiable}
                  onChange={(e) => setNegotiable(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-600 cursor-pointer"
                />
                <span>{t('postAd.negotiableCheck')}</span>
              </label>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  {t('postAd.locationLabel')}
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600 cursor-pointer"
                >
                  <optgroup label={t('hero.citiesGroup')}>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name[lang]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('hero.regionsGroup')}>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name[lang]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {t('postAd.phoneLabel')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatKyrgyzPhoneInput(e.target.value))}
                    placeholder="+996 (700) 12-34-56"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 tabular-nums focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {t('postAd.sellerNameLabel')}
                  </label>
                  <input
                    type="text"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder={t('postAd.sellerNamePlaceholder')}
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={hasWhatsapp}
                  onChange={(e) => setHasWhatsapp(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-600 cursor-pointer"
                />
                <span>{t('postAd.whatsappCheck')}</span>
              </label>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t('postAd.prevStep')}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={goToNext}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t('postAd.nextStep')}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? t('postAd.submitting') : t('postAd.submit')}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
