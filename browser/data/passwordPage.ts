import { installPasswordCapture } from './passwordPageCapture';
import { formInputs, loginPage, passwordInput, safeLoginForm, usernameInput,
  type PasswordPageOptions } from './passwordPageFields';
import { commandPasswordIdentity, fillableUsernameStep, passwordSelector } from './passwordUsernameFirstFields';

function standardLoginForm() {
  return Array.from(document.forms).find(form => safeLoginForm(form) && passwordInput(formInputs(form)));
}

function fillInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input.value === value;
}

function fillUsername(options: PasswordPageOptions, focused?: HTMLInputElement) {
  const identity = options.identity;
  if (!identity?.username || identity.origin !== location.origin) return false;
  if (!focused && standardLoginForm()) return false;
  const inputs = focused
    ? (focused.form && fillableUsernameStep(focused.form) === focused ? [focused] : [])
    : Array.from(document.forms).map(fillableUsernameStep).filter(input => input !== undefined);
  if (inputs.length !== 1 || !fillInput(inputs[0], identity.username)) return false;
  const page = loginPage().__remoteaiLogin;
  if (page && options.focusId) {
    page.usernameChoice = { id: options.focusId, input: inputs[0], username: identity.username.trim() };
  }
  return true;
}

/** Bundled with its helpers into the unprivileged page; only the chosen login is ever sent here. */
export function passwordPage(options: PasswordPageOptions): unknown {
  if (window.top !== window || !['http:', 'https:'].includes(location.protocol)) return null;
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
  const focus = options.focusId ? page.__remoteaiLogin?.focus : undefined;
  if (options.focusId && (focus?.id !== options.focusId || !focus.input.isConnected)) return false;
  if (options.action === 'fillUsername') return fillUsername(options, focus?.input);
  const login = options.login;
  if (!login || login.origin !== location.origin) return false;
  const form = focus ? focus.input.form : standardLoginForm();
  if (!form) {
    const inputs = focus ? [focus.input] : Array.from(document.querySelectorAll<HTMLInputElement>(passwordSelector));
    const matching = inputs.filter(input => commandPasswordIdentity(input)?.username === login.username);
    return matching.length === 1 && fillInput(matching[0], login.password);
  }
  if (!safeLoginForm(form)) return false;
  const fields = formInputs(form), password = passwordInput(fields);
  if (!password) return false;
  const username = usernameInput(fields);
  if (username) fillInput(username, login.username);
  return fillInput(password, login.password);
}
