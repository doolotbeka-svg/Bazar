import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flag, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { authHeaders } from '../lib/session';

export const REPORT_REASONS = [
  { id: 'fraud', kg: 'Алдамчылык', ru: 'Мошенничество' },
  { id: 'prohibited', kg: 'Тыюу салынган товар же кызмат', ru: 'Запрещённый товар или услуга' },
  { id: 'wrong_info', kg: 'Туура эмес баа, сүрөт же маалымат', ru: 'Неверная цена, фото или описание' },
  { id: 'duplicate', kg: 'Кайталанган жарыя', ru: 'Повторное объявление' },
  { id: 'sold', kg: 'Сатылып кеткен / актуалдуу эмес', ru: 'Уже продано / неактуально' },
  { id: 'offensive', kg: 'Орой же уят мазмун', ru: 'Оскорбительное содержание' },
  { id: 'other', kg: 'Башка себеп', ru: 'Другая причина' }
] as const;

interface ReportModalProps {
  listingId: string;
  onClose: () => void;
}

/** "Пожаловаться" dialog: reason + optional comment, sent to the moderators. */
export function ReportModal({ listingId, onClose }: ReportModalProps) {
  const { lang } = useI18n();
  const kg = lang === 'kg';
  const [reason, setReason] = useState<string>('');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'limit'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setState('sending');
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/report`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason, comment })
      });
      setState(res.ok ? 'done' : res.status === 429 ? 'limit' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="report-title" className="text-[18px] font-bold flex items-center gap-2">
            <Flag className="w-5 h-5 text-rose-500" />
            {kg ? 'Даттануу' : 'Пожаловаться'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={kg ? 'Жабуу' : 'Закрыть'}
            className="w-9 h-9 -mr-2 rounded-lg hover:bg-tile flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {state === 'done' ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-go-500 mx-auto" />
            <p className="mt-3 text-[15px] font-semibold">{kg ? 'Рахмат! Даттануу жөнөтүлдү.' : 'Спасибо! Жалоба отправлена.'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {kg ? 'Модератор жарыяны текшерет.' : 'Модератор проверит объявление.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-11 px-6 rounded-xl bg-tile hover:bg-tile-hover text-sm font-semibold cursor-pointer"
            >
              {kg ? 'Жабуу' : 'Закрыть'}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4">
            <fieldset>
              <legend className="text-sm text-slate-600 mb-2">{kg ? 'Себебин тандаңыз' : 'Выберите причину'}</legend>
              <div className="flex flex-col gap-1">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${
                      reason === r.id ? 'bg-brand-50 ring-1 ring-brand-500' : 'hover:bg-tile'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="accent-brand-600"
                    />
                    <span className="text-[14px]">{kg ? r.kg : r.ru}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block mt-4">
              <span className="text-sm text-slate-600">{kg ? 'Комментарий (милдеттүү эмес)' : 'Комментарий (необязательно)'}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>

            {(state === 'error' || state === 'limit') && (
              <p className="mt-3 text-sm text-rose-600" role="alert">
                {state === 'limit'
                  ? kg
                    ? 'Бүгүн өтө көп даттануу жөнөттүңүз. Эртең кайра аракет кылыңыз.'
                    : 'Сегодня отправлено слишком много жалоб. Попробуйте завтра.'
                  : kg
                    ? 'Жөнөтүлгөн жок. Кайра аракет кылыңыз.'
                    : 'Не удалось отправить. Попробуйте ещё раз.'}
              </p>
            )}

            <button
              type="submit"
              disabled={!reason || state === 'sending'}
              className="mt-4 w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[15px] font-bold cursor-pointer"
            >
              {state === 'sending' ? (kg ? 'Жөнөтүлүүдө…' : 'Отправка…') : kg ? 'Жөнөтүү' : 'Отправить'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
