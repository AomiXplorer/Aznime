'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

interface TurnstileWidgetProps {
  siteKey: string;
  resetSignal: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}

/**
 * Widget Turnstile asli dari Cloudflare. Tidak ada CAPTCHA tiruan: kalau
 * script gagal dimuat, yang tampil pesan gagal, bukan kotak centang palsu.
 */
export function TurnstileWidget({ siteKey, resetSignal, onToken, onExpire, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const handlersRef = useRef({ onToken, onExpire, onError });
  handlersRef.current = { onToken, onExpire, onError };

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    void loadScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => handlersRef.current.onToken(token),
          'expired-callback': () => handlersRef.current.onExpire(),
          'error-callback': () => handlersRef.current.onError(),
        });
      } catch {
        handlersRef.current.onError();
      }
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget sudah lepas */
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  // Token sekali pakai: setiap kegagalan menaikkan resetSignal dan widget
  // dirender ulang supaya pengguna bisa verifikasi lagi.
  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* abaikan */
      }
    }
  }, [resetSignal]);

  return <div ref={containerRef} className="min-h-[65px] w-full" aria-label="Verifikasi keamanan Cloudflare" />;
}
