import type { Login } from './model';
import { clickedSubmitter, loginPage, safeLoginForm } from './passwordPageFields';
import { commandPassword, commandPasswordIdentity, isCommandPassword, passwordSelector,
  usernameFirstIdentity } from './passwordUsernameFirstFields';

const PASSWORD_STEP_LIFETIME_MS = 30 * 1000;

function activatedPassword(event: MouseEvent | KeyboardEvent) {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  if (event instanceof MouseEvent) {
    const button = event.target.closest('button');
    return button ? commandPassword(button) : undefined;
  }
  if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey
    || !(event.target instanceof HTMLInputElement)) return;
  if (isCommandPassword(event.target)) return event.target;
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
  const page = loginPage().__remoteaiLogin;
  if (!page) return;
  let stopWatching: (() => void) | undefined;
  const stop = () => { stopWatching?.(); stopWatching = undefined; };
  const remember = (form: HTMLFormElement | null, submitter?: HTMLElement | null) => {
    if (!form || !safeLoginForm(form, submitter) || form.matches(':invalid')) return;
    const input = usernameFirstIdentity(form), username = input?.value.trim(), choice = page.usernameChoice;
    if (!username || username.length > 512) return;
    const continuationId = choice?.input === input && choice?.username === username ? choice.id : undefined;
    page.usernameStep = { form, username, at: performance.now(), continuationId };
  };
  document.addEventListener('submit', event => {
    if (event.isTrusted && event.target instanceof HTMLFormElement) remember(event.target, event.submitter);
  }, true);

  const onActivation = (event: MouseEvent | KeyboardEvent) => {
    if (!event.isTrusted || (event instanceof KeyboardEvent && event.key !== 'Enter')) return;
    stop();
    const input = activatedPassword(event);
    if (!input?.value || input.value.length > 4096) return;
    const identity = commandPasswordIdentity(input);
    if (!identity) return;
    const login = { origin: location.origin, username: identity.username, password: input.value };
    stopWatching = watchPasswordStep(input, () => {
      stop();
      page.usernameStep = undefined;
      page.usernameChoice = undefined;
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
