import { useEffect, useRef, useState } from 'react';

/* Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client) */
interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gsiPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('Failed to load Google Sign-In'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

interface Props {
  clientId: string;
  lang: 'kg' | 'ru';
  /** Called with the Google ID token; the server verifies it. */
  onCredential: (credential: string) => void;
  onError: () => void;
}

/** Official "Sign in with Google" button rendered by Google Identity Services. */
export function GoogleSignInButton({ clientId, lang, onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        const api = window.google?.accounts?.id;
        if (cancelled || !api || !containerRef.current) return;
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          }
        });
        api.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: lang === 'kg' ? 'ky' : 'ru',
          width: Math.min(containerRef.current.offsetWidth || 320, 400)
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onError();
        }
      });
    return () => {
      cancelled = true;
    };
    // onError is only used for reporting; re-rendering the button is not needed when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, lang]);

  if (failed) return null;
  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />;
}
