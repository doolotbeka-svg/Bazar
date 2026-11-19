import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { UserProfile } from '../types/marketplace';

interface Props {
  lang: 'kg' | 'ru';
  onLogin: (user: UserProfile, serverFavorites: string[], token: string) => void;
}

type Phase = 'idle' | 'starting' | 'waiting' | 'expired' | 'error';

const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000;

/**
 * "Sign in with Telegram" through the bot: opens t.me/<bot>?start=login_<nonce>,
 * the user presses Start and Confirm in Telegram, and this page polls until
 * the server reports the login as confirmed.
 */
export function TelegramBotLogin({ lang, onLogin }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => stop, []);

  const poll = (nonce: string, startedAt: number) => {
    timerRef.current = setTimeout(async () => {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setPhase('expired');
        return;
      }
      try {
        const res = await fetch('/api/auth/telegram-bot/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce })
        });
        const data = (await res.json()) as {
          status?: string;
          user?: UserProfile;
          favorites?: string[];
          token?: string;
        };
        if (data.status === 'ok' && data.user && data.token) {
          stop();
          onLoginRef.current(data.user, data.favorites || [], data.token);
          return;
        }
        if (data.status === 'expired') {
          setPhase('expired');
          return;
        }
      } catch {
        // network hiccup: keep polling
      }
      poll(nonce, startedAt);
    }, POLL_MS);
  };

  const start = async () => {
    stop();
    setPhase('starting');
    // Open the tab synchronously (inside the click) so pop-up blockers allow it
    const tab = window.open('', '_blank');
    try {
      const res = await fetch('/api/auth/telegram-bot/start', { method: 'POST' });
      if (!res.ok) throw new Error('start failed');
      const { nonce, url } = (await res.json()) as { nonce: string; url: string };
      setLink(url);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setPhase('waiting');
      poll(nonce, Date.now());
    } catch {
      tab?.close();
      setPhase('error');
    }
  };

  const kg = lang === 'kg';

  if (phase === 'waiting') {
    return (
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
          <span className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          {kg ? 'Telegram\'да ырастоону күтүп жатабыз…' : 'Ждём подтверждения в Telegram…'}
        </div>
        <ol className="text-left text-xs text-slate-600 bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 list-decimal list-inside">
          <li>{kg ? 'Ачылган @AlMartKgBot чатында «Старт» басыңыз' : 'В открывшемся чате @AlMartKgBot нажмите «Старт» (Start)'}</li>
          <li>{kg ? '«Кирүүнү ырастоо» баскычын басыңыз' : 'Нажмите кнопку «Подтвердить вход»'}</li>
          <li>{kg ? 'Ушул баракчага кайтыңыз — сиз автоматтык түрдө киресиз' : 'Вернитесь на эту страницу — вход произойдёт сам'}</li>
        </ol>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-sky-600 hover:text-sky-700"
          >
            {kg ? 'Telegram ачылган жокпу? Бул жерди басыңыз' : 'Telegram не открылся? Нажмите здесь'}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {phase === 'expired' && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {kg ? 'Шилтеменин мөөнөтү бүттү. Кайра аракет кылыңыз.' : 'Время на вход истекло. Попробуйте ещё раз.'}
        </p>
      )}
      {phase === 'error' && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {kg ? 'Telegram аркылуу кирүү азыр иштебей жатат.' : 'Вход через Telegram сейчас недоступен. Попробуйте позже.'}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={phase === 'starting'}
        className="w-full min-h-[44px] bg-[#2AABEE] hover:bg-[#229ED9] disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <Send className="w-4 h-4" />
        {kg ? 'Telegram аркылуу кирүү' : 'Войти через Telegram'}
      </button>
    </div>
  );
}
