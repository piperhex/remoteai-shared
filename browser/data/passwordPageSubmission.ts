import type { Login } from './model';
import { formInputs, loginPage, passwordInput, postLoginMessage, safeLoginForm, usernameInput,
  type PasswordPageOptions } from './passwordPageFields';

function readLogin(form: HTMLFormElement, commandClick: boolean): Login | undefined {
  const fields = formInputs(form);
  const password = commandClick ? passwordInput(fields) : fields.find(input => input.type === 'password');
  if (!password?.value || password.value.length > 4096) return;
  return { origin: location.origin, username: usernameInput(fields)?.value.slice(0, 512) ?? '',
    password: password.value };
}

function offerLogin(options: PasswordPageOptions, login: Login) {
  const page = loginPage();
  if (!postLoginMessage(options, { type: 'browser-login', login }) && page.__remoteaiLogin) {
    page.__remoteaiLogin.pending = login;
  }
}

function clickedSubmitter(event: MouseEvent) {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const control = event.target.closest('button, input');
  if (!(control instanceof HTMLButtonElement || control instanceof HTMLInputElement)) return;
  if ((control.type === 'submit' || control.type === 'image') && !control.matches(':disabled')) return control;
}

export function observeLoginSubmissions(options: PasswordPageOptions) {
  const pending = new WeakMap<HTMLFormElement, Login>();
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!event.isTrusted || !(form instanceof HTMLFormElement)) return;
    const clickedLogin = pending.get(form);
    pending.delete(form);
    if (!safeLoginForm(form, event.submitter)) return;
    const login = readLogin(form, false) ?? clickedLogin;
    if (login) offerLogin(options, login);
  }, true);

  document.addEventListener('click', event => {
    const control = clickedSubmitter(event), form = control?.form;
    if (!form || !safeLoginForm(form, control)) return;
    // A command may clear or disable the fields before cancelling the submit button's default action.
    const login = readLogin(form, true);
    if (!login) return;
    const validBeforeClick = !form.matches(':invalid');
    pending.set(form, login);
    window.setTimeout(() => {
      if (pending.get(form) !== login) return;
      pending.delete(form);
      if (!event.defaultPrevented || !safeLoginForm(form, control)) return;
      // Login commands may clear required fields or accept and disable a short username in an email field.
      if (validBeforeClick || !form.matches(':invalid')) offerLogin(options, login);
    }, 0);
  }, true);
}
