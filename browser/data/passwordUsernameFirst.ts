import type { Login } from './model';
import { autocompleteField, clickedSubmitter, formInputs, passwordInput, safeLoginForm } from './passwordPageFields';

const USERNAME_STEP_LIFETIME_MS = 10 * 60 * 1000;
const PASSWORD_STEP_LIFETIME_MS = 30 * 1000;
const loginButtonName = /^(?:(?:button|btn)[-_]?)?(?:sign[-_]?in|log[-_]?in)(?:[-_]?(?:button|btn))?$/i;
const passwordSelector = 'input[type=password]';

function isLoginButton(button: HTMLButtonElement) {
  return button.type === 'button' && !button.form && !button.matches(':disabled')
    && button.getClientRects().length > 0
    && [button.id, button.name, button.dataset.testid ?? ''].some(value => loginButtonName.test(value));
}

function nearbyFields<T extends Element>(element: Element, selector: string, eligible: (field: T) => boolean) {
  for (let scope = element.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
    const matches = Array.from(scope.querySelectorAll<T>(selector)).filter(eligible);
    if (matches.length) return matches;
  }
  return [];
}

function commandPassword(button: HTMLButtonElement) {
  if (!isLoginButton(button)) return;
  const fields = nearbyFields<HTMLInputElement>(button, passwordSelector,
    field => field.getClientRects().length > 0);
  if (fields.length !== 1 || fields[0].form || fields[0].matches(':disabled, [readonly]')) return;
  return passwordInput(fields);
}

function activatedPassword(event: MouseEvent | KeyboardEvent) {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  if (event instanceof MouseEvent) {
    const button = event.target.closest('button');
    return button ? commandPassword(button) : undefined;
  }
  if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey
    || !(event.target instanceof HTMLInputElement)) return;
  const buttons = nearbyFields<HTMLButtonElement>(event.target, 'button', isLoginButton);
  if (buttons.length === 1 && commandPassword(buttons[0]) === event.target) return event.target;
}

function submittedUsername(form: HTMLFormElement | null, submitter?: HTMLElement | null) {
  if (!form || !safeLoginForm(form, submitter) || form.matches(':invalid')) return;
  const fields = formInputs(form);
  if (fields.some(input => input.type === 'password')) return;
  const identities = fields.filter(input => {
    const hint = autocompleteField(input);
    return ['text', 'email', 'tel'].includes(input.type) && (hint === 'username' || hint === 'email');
  });
  const username = identities.length === 1 ? identities[0].value.trim() : '';
  if (username && username.length <= 512) return { form, username, at: performance.now() };
}

type DocumentNavigation = Event & {
  destination: { sameDocument: boolean }; navigationType: string; userInitiated: boolean;
};

function watchPasswordStep(input: HTMLInputElement, accepted: () => void, stop: () => void) {
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  const onNavigate = (event: Event) => {
    const { destination, navigationType, userInitiated } = event as DocumentNavigation;
    if (event.isTrusted && !userInitiated && !destination.sameDocument && input.value
      && (navigationType === 'push' || navigationType === 'replace')) accepted();
  };
  const observer = new MutationObserver(() => {
    if (input.isConnected) {
      if (!input.value) stop();
      return;
    }
    const replacement = Array.from(document.querySelectorAll<HTMLInputElement>(passwordSelector))
      .some(field => !field.form && field.getClientRects().length > 0);
    if (replacement) stop();
    else accepted();
  });
  // JavaScript-only login commands have no submit event. Wait for the password step to advance.
  observer.observe(document, { childList: true, subtree: true });
  navigation?.addEventListener('navigate', onNavigate);
  const timeout = window.setTimeout(stop, PASSWORD_STEP_LIFETIME_MS);
  return () => {
    observer.disconnect();
    navigation?.removeEventListener('navigate', onNavigate);
    window.clearTimeout(timeout);
  };
}

export function observeUsernameFirstLogin(offer: (login: Login) => void) {
  let previous: ReturnType<typeof submittedUsername>;
  let stopWatching: (() => void) | undefined;
  const stop = () => { stopWatching?.(); stopWatching = undefined; };
  const remember = (form: HTMLFormElement | null, submitter?: HTMLElement | null) => {
    const username = submittedUsername(form, submitter);
    if (username) previous = username;
  };
  document.addEventListener('submit', event => {
    if (event.isTrusted && event.target instanceof HTMLFormElement) remember(event.target, event.submitter);
  }, true);

  const onActivation = (event: MouseEvent | KeyboardEvent) => {
    if (!event.isTrusted || (event instanceof KeyboardEvent && event.key !== 'Enter')) return;
    stop();
    if (!previous || performance.now() - previous.at > USERNAME_STEP_LIFETIME_MS
      || (previous.form.isConnected && previous.form.getClientRects().length > 0)) return;
    const input = activatedPassword(event);
    if (!input?.value || input.value.length > 4096) return;
    const login = { origin: location.origin, username: previous.username, password: input.value };
    stopWatching = watchPasswordStep(input, () => {
      stop();
      previous = undefined;
      offer(login);
    }, stop);
  };
  document.addEventListener('click', event => {
    // The Next button can transition to the password step without dispatching a submit event.
    const submitter = clickedSubmitter(event);
    if (submitter) remember(submitter.form, submitter);
    onActivation(event);
  }, true);
  document.addEventListener('keyup', onActivation, true);
  document.addEventListener('input', event => { if (event.isTrusted) stop(); }, true);
}
