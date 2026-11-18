import { useEffect, useRef } from 'react';

export type TelegramAuthData = Record<string, string | number>;

declare global {
  interface Window {
    __almartTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

interface Props {
  botName: string;
  lang: 'kg' | 'ru';
  /** Signed user object from Telegram; the server verifies the signature. */
  onAuth: (data: TelegramAuthData) => void;
}

/** Official Telegram Login Widget (https://core.telegram.org/widgets/login). */
export function TelegramLoginButton({ botName, lang, onAuth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onAuth);
  callbackRef.current = onAuth;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    window.__almartTelegramAuth = (user) => callbackRef.current(user);

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-lang', 'ru'); // the widget has no Kyrgyz locale
    script.setAttribute('data-onauth', '__almartTelegramAuth(user)');
    container.replaceChildren(script);

    return () => {
      container.replaceChildren();
      delete window.__almartTelegramAuth;
    };
  }, [botName, lang]);

  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />;
}
