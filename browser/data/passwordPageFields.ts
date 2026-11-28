import type { Login } from './model';
import type { PasswordFocus } from './passwordFocus';

export interface PasswordPageOptions {
  action: 'install' | 'take' | 'takeFocus' | 'fill' | 'fillUsername';
  login?: Login; identity?: Pick<Login, 'origin' | 'username'>; focusId?: string; native?: boolean; desktop?: boolean;
}
interface PageState {
  installed: boolean; pending: Login | null; pendingFocus?: PasswordFocus | null;
  focus?: { id: string; input: HTMLInputElement };
  usernameChoice?: { id: string; input: HTMLInputElement; username: string };
  usernameStep?: { form: HTMLFormElement; username: string; at: number; continuationId?: string };
}
export const loginPage = () => window as Window & { __remoteaiLogin?: PageState;
  chrome?: { webview?: { postMessage: (value: unknown) => void } };
  ReactNativeWebView?: { postMessage: (value: string) => void } };
export const formInputs = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLInputElement>('input'))
  .filter(input => !input.disabled && input.type !== 'hidden' && input.getClientRects().length > 0);
export const autocompleteField = (input: HTMLInputElement) => input.autocomplete.trim().toLowerCase().split(/\s+/)
  .filter(token => token !== 'webauthn').pop();
export const usernameInput = (fields: HTMLInputElement[]) => fields.find(input => autocompleteField(input) === 'username')
  ?? fields.find(input => ['text', 'email', 'tel'].includes(input.type)
    && [input.name, input.id].some(value => value.toLowerCase() === 'username'))
  ?? fields.find(input => input.type === 'email') ?? fields.find(input => ['text', 'tel'].includes(input.type));
export const passwordInput = (fields: HTMLInputElement[]) => fields.find(input => input.type === 'password'
  && autocompleteField(input) !== 'new-password');

export function clickedSubmitter(event: MouseEvent) {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const control = event.target.closest('button, input');
  if (!(control instanceof HTMLButtonElement || control instanceof HTMLInputElement)) return;
  if ((control.type === 'submit' || control.type === 'image') && !control.matches(':disabled')) return control;
}

export function safeLoginForm(form: HTMLFormElement, submitter?: HTMLElement | null) {
  try {
    const override = submitter?.getAttribute('formaction');
    return new URL(form.action || location.href, location.href).origin === location.origin
      && (!override || new URL(override, document.baseURI).origin === location.origin);
  }
  catch { return false; }
}
export function postLoginMessage(options: PasswordPageOptions, message: { type: string } & Record<string, unknown>) {
  const page = loginPage(), serialized = JSON.stringify(message);
  if (options.native && page.ReactNativeWebView) { page.ReactNativeWebView.postMessage(serialized); return true; }
  if (options.desktop && page.chrome?.webview) { page.chrome.webview.postMessage(serialized); return true; }
  return false;
}
