import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { BrowserTab } from '../../provider-market/browserState';
import { useBrowserData } from './context';
import { loginOrigin } from './model';
import { isPasswordFocus, matchingPasswords, USERNAME_STEP_LIFETIME_MS,
  type PasswordFill, type PasswordFocus } from './passwordFocus';

type UsernameSelection = { id: string; origin: string; username: string; expires: number };

export function usePasswordSuggestions(tab: BrowserTab | undefined, active: boolean, fill: PasswordFill | undefined) {
  const { vault } = useBrowserData(), [focus, setFocus] = useState<PasswordFocus>();
  const selection = useRef<UsernameSelection>();
  const closeSuggestions = useCallback(() => setFocus(undefined), []);
  useEffect(() => {
    setFocus(undefined);
    selection.current = undefined;
    if (!isTauri() || !active || !tab || !fill) return;
    let stopped = false, busy = false, latestFocusId = '';
    const receive = (value: unknown) => {
      if (stopped || !isPasswordFocus(value) || value.origin !== loginOrigin(tab.url) || !vault.header()) return;
      latestFocusId = value.id;
      const passwords = vault.snapshot();
      const matches = matchingPasswords(passwords.entries, value);
      const chosen = selection.current;
      const continued = chosen && value.stage === 'password' && value.continuationId === chosen.id
        && value.origin === chosen.origin && value.username === chosen.username && Date.now() <= chosen.expires;
      if (continued && matches[0]) {
        selection.current = undefined;
        void fill(matches[0], value).catch(() => {
          if (!stopped && latestFocusId === value.id) setFocus(value);
        });
        return;
      }
      if (!passwords.unlocked || matches.length) setFocus(value);
    };
    const unlisten = listen<unknown>(`browser-login-focus-${tab.id}`, event => receive(event.payload))
      .catch(() => undefined);
    // Windows sends native focus events immediately; portable WebViews use the fixed event reader.
    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { receive(await invoke('provider_browser_password', { id: tab.id, request: { action: 'takeFocus' } })); }
      catch { /* Closed or navigating pages have no input to suggest for. */ }
      finally { busy = false; }
    };
    const timer = navigator.userAgent.includes('Windows') ? undefined : setInterval(() => void poll(), 500);
    return () => {
      stopped = true; clearInterval(timer);
      void unlisten.then(stop => stop?.());
    };
  }, [tab?.id, tab?.url, active, fill, vault]);
  const choose: PasswordFill | undefined = fill && (async (login, target) => {
    const chosen = target?.stage === 'username' ? { id: target.id, origin: login.origin, username: login.username,
      expires: Date.now() + USERNAME_STEP_LIFETIME_MS } : undefined;
    selection.current = chosen;
    try { await fill(login, target); }
    catch (error) {
      if (selection.current === chosen) selection.current = undefined;
      throw error;
    }
  });
  return { focus, closeSuggestions, fill: choose };
}
