import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Flag,
  ImageOff,
  LayoutList,
  Megaphone,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { MARKETPLACE_CATEGORIES } from '../data/categories';
import { getLocationName, KYRGYZSTAN_LOCATIONS } from '../data/locations';
import type { Listing, ListingStatus, PromoteTier } from '../types/marketplace';
import { formatPrice } from '../utils/format';
import { authHeaders } from '../lib/session';
import { REPORT_REASONS } from '../components/ReportModal';

/* ======================= API helper ======================= */

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...authHeaders(undefined, Boolean(init.body)), ...init.headers } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

type AdminListing = Listing & { openReports: number };
type Report = {
  id: string;
  listingId: string;
  reason: string;
  comment: string;
  reporter: string;
  status: string;
  createdAt: string;
  listingTitle: string | null;
  listingStatus: string | null;
};
type AdminUser = {
  id: string;
  name: string;
  authMethod: string;
  email?: string;
  phone?: string;
  createdAt: string;
  blocked: boolean;
  listings: number;
  isAdmin: boolean;
};
type Tab = 'overview' | 'reports' | 'listings' | 'users' | 'admins' | 'site';

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.ru || id;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active: { text: 'Активно', cls: 'bg-go-50 text-go-700' },
  sold: { text: 'Продано', cls: 'bg-slate-100 text-slate-600' },
  blocked: { text: 'Скрыто модератором', cls: 'bg-rose-50 text-rose-700' }
};

const btn = 'h-9 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50';
const btnGray = `${btn} bg-tile hover:bg-tile-hover text-slate-800`;
const btnRed = `${btn} bg-rose-50 hover:bg-rose-100 text-rose-700`;
const btnBrand = `${btn} bg-brand-500 hover:bg-brand-600 text-white`;
const input =
  'h-10 px-3 rounded-xl border border-slate-200 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500';

/* ======================= page ======================= */

export function AdminPage() {
  const [me, setMe] = useState<{ userId: string | null; isAdmin: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [listingQuery, setListingQuery] = useState('');

  useEffect(() => {
    document.title = 'AlMart — Админка';
    api<{ userId: string | null; isAdmin: boolean }>('/api/admin/me')
      .then(setMe)
      .catch(() => setMe({ userId: null, isAdmin: false }));
  }, []);

  if (!me) {
    return <Centered>Загрузка…</Centered>;
  }
  if (!me.userId) {
    return (
      <Centered>
        <Shield className="w-10 h-10 text-brand-600 mx-auto" />
        <h1 className="mt-3 text-xl font-bold">Админка AlMart</h1>
        <p className="mt-2 text-slate-600">Войдите на сайте в свой аккаунт (через Telegram или Google), затем вернитесь сюда.</p>
        <a href="/" className={`${btnBrand} mt-5 h-11 px-5`}>
          Перейти на сайт
        </a>
      </Centered>
    );
  }
  if (!me.isAdmin) {
    return (
      <Centered>
        <Ban className="w-10 h-10 text-rose-500 mx-auto" />
        <h1 className="mt-3 text-xl font-bold">Нет доступа</h1>
        <p className="mt-2 text-slate-600">У этого аккаунта нет прав администратора. Ваш ID:</p>
        <CopyId id={me.userId} />
        <p className="mt-3 text-[13px] text-slate-500">
          Чтобы стать администратором, добавьте этот ID в переменную <code>ADMIN_USER_IDS</code> в настройках Vercel или
          попросите другого администратора.
        </p>
        <a href="/" className={`${btnGray} mt-5`}>
          <ArrowLeft className="w-4 h-4" /> На сайт
        </a>
      </Centered>
    );
  }

  const tabs: [Tab, string, React.ElementType][] = [
    ['overview', 'Обзор', BarChart3],
    ['reports', 'Жалобы', Flag],
    ['listings', 'Объявления', LayoutList],
    ['users', 'Пользователи', Users],
    ['admins', 'Админы', Shield],
    ['site', 'Сайт', Megaphone]
  ];

  const showSellerListings = (sellerId: string) => {
    setListingQuery(sellerId);
    setTab('listings');
  };

  return (
    <div className="min-h-screen bg-tile/40 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center gap-3">
          <a href="/" className="font-display text-[20px] font-extrabold">
            <span className="text-brand-800">Al</span>
            <span className="text-go-500">Mart</span>
          </a>
          <span className="text-sm font-semibold text-slate-500">Админка</span>
          <a href="/" className="ml-auto text-sm text-brand-700 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> На сайт
          </a>
        </div>
        <nav className="max-w-[1200px] mx-auto px-2 flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 h-11 px-3 text-[14px] font-semibold flex items-center gap-1.5 border-b-2 cursor-pointer ${
                tab === id ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-5">
        {tab === 'overview' && <Overview onOpen={setTab} />}
        {tab === 'reports' && <Reports />}
        {tab === 'listings' && <Listings initialQuery={listingQuery} />}
        {tab === 'users' && <UsersTab myId={me.userId} onShowListings={showSellerListings} />}
        {tab === 'admins' && <Admins myId={me.userId} />}
        {tab === 'site' && <Site />}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-tile/40">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 text-center shadow-sm">{children}</div>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(id)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-tile font-mono text-[13px] cursor-pointer"
    >
      {id}
      {copied ? <Check className="w-4 h-4 text-go-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
    </button>
  );
}

function ErrorLine({ error }: { error: string }) {
  return error ? (
    <p className="my-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm" role="alert">
      {error}
    </p>
  ) : null;
}

/** Load data with a reload function; errors are shown as text. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    return load()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, setError, loading, reload };
}

/* ======================= overview ======================= */

function Overview({ onOpen }: { onOpen: (t: Tab) => void }) {
  const { data, error } = useLoad(() => api<{ stats: Record<string, number> }>('/api/admin/stats'), []);
  const s = data?.stats;
  const cards: [string, number | undefined, Tab, string?][] = [
    ['Открытые жалобы', s?.open_reports, 'reports', s?.open_reports ? 'text-rose-600' : undefined],
    ['Всего объявлений', s?.listings, 'listings'],
    ['Активные', s?.active, 'listings'],
    ['Скрытые', s?.blocked, 'listings'],
    ['Новые за сутки', s?.new_today, 'listings'],
    ['Пользователи', s?.users, 'users'],
    ['Заблокированы', s?.blocked_users, 'users']
  ];
  return (
    <div>
      <ErrorLine error={error} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(([label, value, target, cls]) => (
          <button
            key={label}
            type="button"
            onClick={() => onOpen(target)}
            className="text-left p-4 rounded-2xl bg-white shadow-sm hover:ring-2 hover:ring-brand-200 cursor-pointer"
          >
            <div className="text-[13px] text-slate-500">{label}</div>
            <div className={`mt-1 text-[28px] font-bold tabular-nums ${cls || ''}`}>{value ?? '—'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ======================= reports ======================= */

function Reports() {
  const [status, setStatus] = useState('open');
  const [editing, setEditing] = useState<string | null>(null);
  const { data, error, setError, loading, reload } = useLoad(
    () => api<{ reports: Report[] }>(`/api/admin/reports?status=${status}`),
    [status]
  );

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const hideListing = (r: Report) =>
    act(async () => {
      await api(`/api/admin/listings/${encodeURIComponent(r.listingId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'blocked' })
      });
      await api(`/api/admin/listings/${encodeURIComponent(r.listingId)}/resolve-reports`, { method: 'POST' });
    });

  const setReport = (r: Report, next: string) =>
    act(() => api(`/api/admin/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="open">Открытые</option>
          <option value="resolved">Решённые</option>
          <option value="rejected">Отклонённые</option>
          <option value="all">Все</option>
        </select>
        <button type="button" onClick={reload} className={btnGray}>
          <RefreshCw className="w-4 h-4" /> Обновить
        </button>
      </div>
      <ErrorLine error={error} />
      {loading && !data ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : !data?.reports.length ? (
        <p className="p-8 rounded-2xl bg-white text-center text-slate-500">Жалоб нет.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.reports.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[13px] font-semibold">
                  {reasonLabel(r.reason)}
                </span>
                {r.status !== 'open' && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[12px]">
                    {r.status === 'resolved' ? 'Решено' : 'Отклонено'}
                  </span>
                )}
                <span className="text-[12px] text-slate-500 ml-auto">{fmtDate(r.createdAt)}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold">
                {r.listingTitle ? (
                  <a href={`/?ad=${encodeURIComponent(r.listingId)}`} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.listingTitle} <ExternalLink className="inline w-3.5 h-3.5 text-slate-400" />
                  </a>
                ) : (
                  <span className="text-slate-400">Объявление удалено ({r.listingId})</span>
                )}
                {r.listingStatus && (
                  <span className={`ml-2 px-2 py-0.5 rounded-md text-[12px] font-medium ${STATUS_LABEL[r.listingStatus]?.cls}`}>
                    {STATUS_LABEL[r.listingStatus]?.text}
                  </span>
                )}
              </div>
              {r.comment && <p className="mt-1.5 text-[14px] text-slate-700 whitespace-pre-wrap">«{r.comment}»</p>}
              <div className="mt-1 text-[12px] text-slate-400">От: {r.reporter.startsWith('ip-') ? 'гость' : r.reporter}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.listingTitle && r.listingStatus !== 'blocked' && (
                  <button type="button" onClick={() => hideListing(r)} className={btnRed}>
                    <EyeOff className="w-4 h-4" /> Скрыть объявление
                  </button>
                )}
                {r.listingTitle && (
                  <button type="button" onClick={() => setEditing(r.listingId)} className={btnGray}>
                    <Pencil className="w-4 h-4" /> Изменить
                  </button>
                )}
                {r.status === 'open' ? (
                  <>
                    <button type="button" onClick={() => setReport(r, 'resolved')} className={btnGray}>
                      <Check className="w-4 h-4" /> Решено
                    </button>
                    <button type="button" onClick={() => setReport(r, 'rejected')} className={btnGray}>
                      <X className="w-4 h-4" /> Отклонить
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setReport(r, 'open')} className={btnGray}>
                    <Undo2 className="w-4 h-4" /> Вернуть в открытые
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <EditListingLoader
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ======================= listings ======================= */

function Listings({ initialQuery }: { initialQuery: string }) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<AdminListing | null>(null);
  const { data, error, setError, loading, reload } = useLoad(
    () =>
      api<{ listings: AdminListing[] }>(
        `/api/admin/listings?status=${status}&q=${encodeURIComponent(query)}`
      ),
    [status, query]
  );

  const patch = async (l: AdminListing, body: Record<string, unknown>) => {
    try {
      await api(`/api/admin/listings/${encodeURIComponent(l.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (l: AdminListing) => {
    if (!window.confirm(`Удалить объявление «${l.titleRu || l.titleKg}» навсегда? Фото тоже будут удалены.`)) return;
    try {
      await api(`/api/admin/listings/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <form
        className="flex flex-wrap items-center gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(queryInput.trim());
        }}
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Название, телефон, продавец или ID"
            className={`${input} w-full pl-9`}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="sold">Проданные</option>
          <option value="blocked">Скрытые</option>
        </select>
        <button type="submit" className={btnBrand}>
          Найти
        </button>
      </form>
      <ErrorLine error={error} />
      {loading && !data ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : !data?.listings.length ? (
        <p className="p-8 rounded-2xl bg-white text-center text-slate-500">Ничего не найдено.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-slate-500">Найдено: {data.listings.length}</p>
          <div className="flex flex-col gap-2">
            {data.listings.map((l) => (
              <div key={l.id} className="p-3 rounded-2xl bg-white shadow-sm flex gap-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-tile overflow-hidden shrink-0 flex items-center justify-center">
                  {l.images[0] ? (
                    <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[12px] font-medium ${STATUS_LABEL[l.status]?.cls}`}>
                      {STATUS_LABEL[l.status]?.text}
                    </span>
                    {l.promoteTier !== 'none' && (
                      <span className="px-2 py-0.5 rounded-md text-[12px] font-bold bg-amber-50 text-amber-700 uppercase">
                        {l.promoteTier}
                      </span>
                    )}
                    {l.openReports > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[12px] font-semibold bg-rose-50 text-rose-700">
                        Жалоб: {l.openReports}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold truncate">{l.titleRu || l.titleKg}</div>
                  <div className="text-[13px] text-slate-600">
                    {formatPrice(l.price, l.currency, l.negotiable, 'Договорная')} · {getLocationName(l.locationId, 'ru')} ·{' '}
                    {l.views} просм.
                  </div>
                  <div className="text-[12px] text-slate-400 truncate">
                    {l.sellerName} · {l.phone} · {fmtDate(l.createdAt)} · {l.sellerId}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <a href={`/?ad=${encodeURIComponent(l.id)}`} target="_blank" rel="noreferrer" className={btnGray}>
                      <ExternalLink className="w-4 h-4" /> Открыть
                    </a>
                    <button type="button" onClick={() => setEditing(l)} className={btnGray}>
                      <Pencil className="w-4 h-4" /> Изменить
                    </button>
                    {l.status === 'blocked' ? (
                      <button type="button" onClick={() => patch(l, { status: 'active' })} className={btnGray}>
                        <Undo2 className="w-4 h-4" /> Вернуть
                      </button>
                    ) : (
                      <button type="button" onClick={() => patch(l, { status: 'blocked' })} className={btnRed}>
                        <EyeOff className="w-4 h-4" /> Скрыть
                      </button>
                    )}
                    <button type="button" onClick={() => remove(l)} className={btnRed}>
                      <Trash2 className="w-4 h-4" /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && (
        <EditListingModal
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Fetch one listing (by id) for editing from the reports tab. */
function EditListingLoader({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [listing, setListing] = useState<AdminListing | null>(null);
  useEffect(() => {
    api<{ listings: AdminListing[] }>(`/api/admin/listings?status=all&q=${encodeURIComponent(id)}`)
      .then((d) => {
        const found = d.listings.find((l) => l.id === id);
        if (found) setListing(found);
        else onClose();
      })
      .catch(onClose);
  }, [id, onClose]);
  return listing ? <EditListingModal listing={listing} onClose={onClose} onSaved={onSaved} /> : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function EditListingModal({ listing, onClose, onSaved }: { listing: AdminListing; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({
    titleKg: listing.titleKg || '',
    titleRu: listing.titleRu || '',
    descriptionKg: listing.descriptionKg || '',
    descriptionRu: listing.descriptionRu || '',
    price: listing.price === null ? '' : String(listing.price),
    currency: listing.currency,
    negotiable: listing.negotiable,
    category: listing.category as string,
    locationId: listing.locationId,
    phone: listing.phone,
    hasWhatsapp: listing.hasWhatsapp,
    sellerName: listing.sellerName,
    status: listing.status as ListingStatus,
    promoteTier: listing.promoteTier as PromoteTier,
    views: String(listing.views),
    images: listing.images
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/api/admin/listings/${encodeURIComponent(listing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...f,
          price: f.price.trim() === '' ? null : Number(f.price.replace(/\s/g, '')),
          views: Number(f.views) || 0
        })
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col"
      >
        <div className="px-5 h-14 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-[17px] font-bold">Изменить объявление</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="w-9 h-9 -mr-2 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Заголовок (кырг.)">
            <input value={f.titleKg} onChange={(e) => set('titleKg', e.target.value)} maxLength={140} className={`${input} w-full`} />
          </Field>
          <Field label="Заголовок (рус.)">
            <input value={f.titleRu} onChange={(e) => set('titleRu', e.target.value)} maxLength={140} className={`${input} w-full`} />
          </Field>
          <Field label="Описание (кырг.)">
            <textarea
              value={f.descriptionKg}
              onChange={(e) => set('descriptionKg', e.target.value)}
              rows={5}
              maxLength={3000}
              className={`${input} w-full h-auto py-2`}
            />
          </Field>
          <Field label="Описание (рус.)">
            <textarea
              value={f.descriptionRu}
              onChange={(e) => set('descriptionRu', e.target.value)}
              rows={5}
              maxLength={3000}
              className={`${input} w-full h-auto py-2`}
            />
          </Field>
          <Field label="Цена (пусто — договорная)">
            <div className="flex gap-2">
              <input
                value={f.price}
                onChange={(e) => set('price', e.target.value.replace(/[^\d\s]/g, ''))}
                inputMode="numeric"
                className={`${input} flex-1 min-w-0`}
              />
              <select value={f.currency} onChange={(e) => set('currency', e.target.value as 'KGS' | 'USD')} className={input}>
                <option value="KGS">сом</option>
                <option value="USD">$</option>
              </select>
            </div>
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={f.negotiable} onChange={(e) => set('negotiable', e.target.checked)} />
              Торг возможен
            </label>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={f.hasWhatsapp} onChange={(e) => set('hasWhatsapp', e.target.checked)} />
              Есть WhatsApp
            </label>
          </div>
          <Field label="Категория">
            <select value={f.category} onChange={(e) => set('category', e.target.value)} className={`${input} w-full`}>
              {MARKETPLACE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(`categories.${c.id}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Город / область">
            <select value={f.locationId} onChange={(e) => set('locationId', e.target.value)} className={`${input} w-full`}>
              {KYRGYZSTAN_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name.ru}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Телефон">
            <input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={`${input} w-full`} />
          </Field>
          <Field label="Имя продавца">
            <input value={f.sellerName} onChange={(e) => set('sellerName', e.target.value)} maxLength={80} className={`${input} w-full`} />
          </Field>
          <Field label="Статус">
            <select value={f.status} onChange={(e) => set('status', e.target.value as ListingStatus)} className={`${input} w-full`}>
              <option value="active">Активно</option>
              <option value="sold">Продано</option>
              <option value="blocked">Скрыто модератором</option>
            </select>
          </Field>
          <Field label="Продвижение">
            <select value={f.promoteTier} onChange={(e) => set('promoteTier', e.target.value as PromoteTier)} className={`${input} w-full`}>
              <option value="none">Нет</option>
              <option value="top">TOP</option>
              <option value="vip">VIP</option>
            </select>
          </Field>
          <Field label="Просмотры">
            <input
              value={f.views}
              onChange={(e) => set('views', e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className={`${input} w-full`}
            />
          </Field>
          <div className="sm:col-span-2">
            <span className="text-[13px] font-medium text-slate-600">Фото (можно удалить лишние)</span>
            {f.images.length === 0 ? (
              <p className="mt-1 text-sm text-slate-400">Нет фото</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {f.images.map((img) => (
                  <div key={img} className="relative w-24 h-24 rounded-xl overflow-hidden bg-tile">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => set('images', f.images.filter((x) => x !== img))}
                      aria-label="Удалить фото"
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <ErrorLine error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${btnGray} h-11 px-5`}>
              Отмена
            </button>
            <button type="submit" disabled={saving} className={`${btnBrand} h-11 px-5`}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ======================= users ======================= */

const METHOD: Record<string, string> = { telegram: 'Telegram', google: 'Google', phone: 'Телефон' };

function UsersTab({ myId, onShowListings }: { myId: string; onShowListings: (id: string) => void }) {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, setError, loading, reload } = useLoad(
    () => api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`),
    [query]
  );

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleBlock = (u: AdminUser) => {
    if (!u.blocked && !window.confirm(`Заблокировать «${u.name}»? Все его объявления будут скрыты, войти он не сможет.`)) return;
    run(() => api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: JSON.stringify({ blocked: !u.blocked }) }));
  };

  const makeAdmin = (u: AdminUser) => {
    if (!window.confirm(`Сделать «${u.name}» администратором? Он получит полный доступ к админке.`)) return;
    run(() => api('/api/admin/admins', { method: 'POST', body: JSON.stringify({ userId: u.id }) }));
  };

  return (
    <div>
      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(queryInput.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Имя, e-mail, телефон или ID"
            className={`${input} w-full pl-9`}
          />
        </div>
        <button type="submit" className={btnBrand}>
          Найти
        </button>
      </form>
      <ErrorLine error={error} />
      {loading && !data ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : !data?.users.length ? (
        <p className="p-8 rounded-2xl bg-white text-center text-slate-500">Пользователей нет.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.users.map((u) => (
            <div key={u.id} className="p-4 rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold">{u.name}</span>
                <span className="px-2 py-0.5 rounded-md bg-tile text-[12px]">{METHOD[u.authMethod] || u.authMethod}</span>
                {u.isAdmin && <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[12px] font-semibold">Админ</span>}
                {u.blocked && <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[12px] font-semibold">Заблокирован</span>}
                {u.id === myId && <span className="text-[12px] text-slate-400">(это вы)</span>}
              </div>
              <div className="mt-1 text-[13px] text-slate-600">
                {[u.email, u.phone].filter(Boolean).join(' · ')}
                {(u.email || u.phone) && ' · '}с {fmtDate(u.createdAt)} · объявлений: {u.listings}
              </div>
              <div className="text-[12px] text-slate-400 font-mono">{u.id}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onShowListings(u.id)} className={btnGray}>
                  <LayoutList className="w-4 h-4" /> Объявления
                </button>
                {!u.isAdmin && (
                  <button type="button" onClick={() => toggleBlock(u)} className={u.blocked ? btnGray : btnRed}>
                    {u.blocked ? <Undo2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    {u.blocked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                )}
                {!u.isAdmin && !u.blocked && (
                  <button type="button" onClick={() => makeAdmin(u)} className={btnGray}>
                    <Shield className="w-4 h-4" /> Сделать админом
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[12px] text-slate-500">
        После разблокировки объявления пользователя остаются скрытыми — верните нужные во вкладке «Объявления».
      </p>
    </div>
  );
}

/* ======================= admins ======================= */

function Admins({ myId }: { myId: string }) {
  const [newId, setNewId] = useState('');
  const { data, error, setError, reload } = useLoad(
    () =>
      api<{ fromSettings: string[]; added: { userId: string; addedBy: string; createdAt: string; name: string | null }[] }>(
        '/api/admin/admins'
      ),
    []
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/admin/admins', { method: 'POST', body: JSON.stringify({ userId: newId.trim() }) });
      setNewId('');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (userId: string) => {
    if (!window.confirm(userId === myId ? 'Убрать права администратора у себя?' : `Убрать права администратора у ${userId}?`)) return;
    try {
      await api(`/api/admin/admins/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (userId === myId) window.location.reload();
      else await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl">
      <ErrorLine error={error} />
      <div className="p-4 rounded-2xl bg-white shadow-sm">
        <h3 className="font-bold">Администраторы</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {data?.fromSettings.map((id) => (
            <li key={id} className="py-2 flex items-center gap-2 text-[14px]">
              <span className="font-mono">{id}</span>
              {id === myId && <span className="text-[12px] text-slate-400">(это вы)</span>}
              <span className="ml-auto text-[12px] text-slate-500">из настроек Vercel</span>
            </li>
          ))}
          {data?.added.map((a) => (
            <li key={a.userId} className="py-2 flex items-center gap-2 text-[14px]">
              <span>
                {a.name && <span className="font-semibold mr-1.5">{a.name}</span>}
                <span className="font-mono text-slate-600">{a.userId}</span>
                {a.userId === myId && <span className="ml-1 text-[12px] text-slate-400">(это вы)</span>}
              </span>
              <button type="button" onClick={() => remove(a.userId)} className={`${btnRed} ml-auto`}>
                <Trash2 className="w-4 h-4" /> Убрать
              </button>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={add} className="mt-4 p-4 rounded-2xl bg-white shadow-sm">
        <h3 className="font-bold">Добавить администратора</h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Укажите ID пользователя (например, <code>telegram-123456789</code>). Его видно во вкладке «Пользователи» или на этой
          странице у самого пользователя, если у него нет доступа.
        </p>
        <div className="mt-3 flex gap-2">
          <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="telegram-…" className={`${input} flex-1`} />
          <button type="submit" disabled={!newId.trim()} className={btnBrand}>
            <UserPlus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </form>
    </div>
  );
}

/* ======================= site ======================= */

function Site() {
  const [kg, setKg] = useState('');
  const [ru, setRu] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ announcement: { kg: string; ru: string } | null }>('/api/site')
      .then((d) => {
        setKg(d.announcement?.kg || '');
        setRu(d.announcement?.ru || '');
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async (nextKg: string, nextRu: string) => {
    setState('saving');
    setError('');
    try {
      await api('/api/admin/site', { method: 'PUT', body: JSON.stringify({ announcementKg: nextKg, announcementRu: nextRu }) });
      setKg(nextKg);
      setRu(nextRu);
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  };

  return (
    <div className="max-w-2xl">
      <ErrorLine error={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(kg.trim(), ru.trim());
        }}
        className="p-4 rounded-2xl bg-white shadow-sm"
      >
        <h3 className="font-bold flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-600" /> Объявление для всех посетителей
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Жёлтая полоска вверху сайта: новости, технические работы, акции. Оставьте пустым, чтобы скрыть.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Текст на кыргызском">
            <textarea value={kg} onChange={(e) => setKg(e.target.value)} rows={2} maxLength={300} className={`${input} w-full h-auto py-2`} />
          </Field>
          <Field label="Текст на русском">
            <textarea value={ru} onChange={(e) => setRu(e.target.value)} rows={2} maxLength={300} className={`${input} w-full h-auto py-2`} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={state === 'saving'} className={btnBrand}>
            {state === 'saved' ? <Check className="w-4 h-4" /> : null}
            {state === 'saving' ? 'Сохранение…' : state === 'saved' ? 'Сохранено' : 'Сохранить'}
          </button>
          {(kg || ru) && (
            <button type="button" onClick={() => save('', '')} className={btnGray}>
              Убрать объявление
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
