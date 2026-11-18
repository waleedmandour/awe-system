'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker (/public/sw.js) once the page has loaded.
 *
 * Without this component the service worker file is never installed, so the
 * app has no offline caching despite shipping sw.js and an installable
 * manifest. Registration is intentionally deferred until `load` so it never
 * competes with the first render, and a failure is logged as a warning only —
 * offline support is an enhancement, never a blocker.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('[PWA] Service worker registration failed:', err));
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
