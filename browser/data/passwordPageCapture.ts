import { formInputs, loginPage, passwordInput, postLoginMessage, safeLoginForm, usernameInput,
  type PasswordPageOptions } from './passwordPageFields';
import { observeLoginSubmissions } from './passwordPageSubmission';
import { commandPasswordIdentity, fillableUsernameStep } from './passwordUsernameFirstFields';
import type { PasswordFocus } from './passwordFocus';

function describeInput(input: HTMLInputElement): Pick<PasswordFocus, 'username' | 'stage' | 'continuationId'> | undefined {
  const form = input.form;
  if (!form) {
    const identity = commandPasswordIdentity(input);
    return identity && { ...identity, stage: 'password' };
  }
  if (!safeLoginForm(form)) return;
  const fields = formInputs(form), password = passwordInput(fields), username = usernameInput(fields);
  if (password && (input === password || input === username)) return { username: username?.value ?? '' };
  if (!password && fillableUsernameStep(form) === input) return { username: input.value, stage: 'username' };
}

function captureFocus(event: Event, options: PasswordPageOptions) {
  const input = event.target, page = loginPage();
  if (!event.isTrusted || !(input instanceof HTMLInputElement) || !page.__remoteaiLogin) return;
  const description = describeInput(input);
  if (!description) return;
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  page.__remoteaiLogin.focus = { id, input };
  const { x, y, width, height } = input.getBoundingClientRect();
  const focus = { ...description, origin: location.origin, id, username: description.username.slice(0, 512),
    bounds: { x, y, width, height }, viewport: { width: innerWidth, height: innerHeight } };
  if (!postLoginMessage(options, { type: 'browser-login-focus', focus })) page.__remoteaiLogin.pendingFocus = focus;
}

export function installPasswordCapture(options: PasswordPageOptions) {
  const page = loginPage();
  if (page.__remoteaiLogin?.installed) return true;
  page.__remoteaiLogin = { installed: true, pending: null };
  observeLoginSubmissions(options);
  document.addEventListener('click', event => captureFocus(event, options), true);
  let tabFocus = false;
  document.addEventListener('keydown', event => { tabFocus = event.isTrusted && event.key === 'Tab'; }, true);
  document.addEventListener('focusin', event => {
    const input = event.target;
    if (tabFocus) captureFocus(event, options);
    else if (event.isTrusted && input instanceof HTMLInputElement && input.type === 'password' && !input.form) {
      // Let the site finish rendering the next step, and let a click handle its own focus event.
      window.setTimeout(() => {
        if (document.activeElement === input && page.__remoteaiLogin?.focus?.input !== input) {
          captureFocus(event, options);
        }
      }, 0);
    }
    tabFocus = false;
  }, true);
  return true;
}
