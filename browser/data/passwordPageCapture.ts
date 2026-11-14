import { formInputs, loginPage, passwordInput, postLoginMessage, safeLoginForm, usernameInput,
  type PasswordPageOptions } from './passwordPageFields';

function captureLogin(event: SubmitEvent, options: PasswordPageOptions) {
  const form = event.target, page = loginPage();
  if (!(form instanceof HTMLFormElement) || !event.isTrusted || !safeLoginForm(form)) return;
  const fields = formInputs(form), password = fields.find(input => input.type === 'password');
  if (!password?.value || password.value.length > 4096) return;
  const login = { origin: location.origin, username: usernameInput(fields)?.value.slice(0, 512) ?? '',
    password: password.value };
  if (!postLoginMessage(options, { type: 'browser-login', login }) && page.__remoteaiLogin) {
    page.__remoteaiLogin.pending = login;
  }
}

function captureFocus(event: Event, options: PasswordPageOptions) {
  const input = event.target, page = loginPage();
  if (!event.isTrusted || !(input instanceof HTMLInputElement) || !input.form || !page.__remoteaiLogin) return;
  const fields = formInputs(input.form), password = passwordInput(fields);
  if (!safeLoginForm(input.form) || !password || !fields.includes(input)
    || input !== password && input !== usernameInput(fields)) return;
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  page.__remoteaiLogin.focus = { id, input };
  const { x, y, width, height } = input.getBoundingClientRect();
  const focus = { origin: location.origin, id, username: usernameInput(fields)?.value.slice(0, 512) ?? '',
    bounds: { x, y, width, height }, viewport: { width: innerWidth, height: innerHeight } };
  if (!postLoginMessage(options, { type: 'browser-login-focus', focus })) page.__remoteaiLogin.pendingFocus = focus;
}

export function installPasswordCapture(options: PasswordPageOptions) {
  const page = loginPage();
  if (page.__remoteaiLogin?.installed) return true;
  page.__remoteaiLogin = { installed: true, pending: null };
  document.addEventListener('submit', event => captureLogin(event, options), true);
  document.addEventListener('click', event => captureFocus(event, options), true);
  let tabFocus = false;
  document.addEventListener('keydown', event => { tabFocus = event.isTrusted && event.key === 'Tab'; }, true);
  document.addEventListener('focusin', event => {
    if (tabFocus) captureFocus(event, options);
    tabFocus = false;
  }, true);
  return true;
}
