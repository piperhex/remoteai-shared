import { installPasswordCapture } from './passwordPageCapture';
import { formInputs, loginPage, passwordInput, safeLoginForm, usernameInput,
  type PasswordPageOptions } from './passwordPageFields';

/** Bundled with its helpers into the unprivileged page; only the chosen login is ever sent here. */
export function passwordPage(options: PasswordPageOptions): unknown {
  if (window.top !== window || location.protocol !== 'https:') return null;
  const page = loginPage();
  if (options.action === 'install') return installPasswordCapture(options);
  if (options.action === 'take') {
    const login = page.__remoteaiLogin?.pending;
    if (page.__remoteaiLogin) page.__remoteaiLogin.pending = null;
    return login ?? null;
  }
  if (options.action === 'takeFocus') {
    const focus = page.__remoteaiLogin?.pendingFocus;
    if (page.__remoteaiLogin) page.__remoteaiLogin.pendingFocus = null;
    return focus ?? null;
  }
  const login = options.login;
  if (!login || login.origin !== location.origin) return false;
  const focus = options.focusId ? page.__remoteaiLogin?.focus : undefined;
  if (options.focusId && (focus?.id !== options.focusId || !focus.input.isConnected)) return false;
  const form = focus ? focus.input.form : Array.from(document.forms)
    .find(form => safeLoginForm(form) && passwordInput(formInputs(form)));
  if (!form || !safeLoginForm(form)) return false;
  const fields = formInputs(form), password = passwordInput(fields);
  if (!password) return false;
  const set = (input: HTMLInputElement | undefined, value: string) => {
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set(usernameInput(fields), login.username); set(password, login.password);
  return password.value === login.password;
}
