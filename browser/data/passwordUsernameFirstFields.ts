import { USERNAME_STEP_LIFETIME_MS } from './passwordFocus';
import { autocompleteField, formInputs, loginPage, passwordInput, safeLoginForm } from './passwordPageFields';

const signInName = /^(?:(?:button|btn)[-_]?)?(?:sign[-_]?in|log[-_]?in)(?:[-_]?(?:button|btn))?$/i;
const nextStepName = /^(?:(?:button|btn)[-_]?)?(?:next|continue)(?:[-_]?(?:button|btn))?$/i;
export const passwordSelector = 'input[type=password]';

const commandMatches = (control: HTMLButtonElement | HTMLInputElement, pattern: RegExp) =>
  [control.id, control.name, control.dataset.testid ?? ''].some(value => pattern.test(value));
const isVisible = (element: Element) => element.getClientRects().length > 0;
const isAwsSignIn = () => location.protocol === 'https:'
  && (location.hostname === 'signin.aws.amazon.com' || location.hostname.endsWith('.signin.aws.amazon.com'));

function nearbyFields<T extends Element>(element: Element, selector: string, eligible: (field: T) => boolean) {
  for (let scope = element.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
    const matches = Array.from(scope.querySelectorAll<T>(selector)).filter(eligible);
    if (matches.length) return matches;
  }
  return [];
}

function isLoginButton(button: HTMLButtonElement) {
  return button.type === 'button' && !button.form && !button.matches(':disabled')
    && isVisible(button) && commandMatches(button, signInName);
}

export function commandPassword(button: HTMLButtonElement) {
  if (!isLoginButton(button)) return;
  const fields = nearbyFields<HTMLInputElement>(button, passwordSelector, isVisible);
  if (fields.length !== 1 || fields[0].form || fields[0].matches(':disabled, [readonly]')) return;
  return passwordInput(fields);
}

export function isCommandPassword(input: HTMLInputElement) {
  if (input.type !== 'password' || input.form) return false;
  const buttons = nearbyFields<HTMLButtonElement>(input, 'button', isLoginButton);
  return buttons.length === 1 && commandPassword(buttons[0]) === input;
}

export function usernameFirstIdentity(form: HTMLFormElement) {
  const fields = formInputs(form);
  if (fields.some(input => input.type === 'password')) return;
  const identities = fields.filter(input => {
    const hint = autocompleteField(input);
    return ['text', 'email', 'tel'].includes(input.type) && (hint === 'username' || hint === 'email');
  });
  if (identities.length === 1) return identities[0];
}

export function fillableUsernameStep(form: HTMLFormElement) {
  if (!safeLoginForm(form)) return;
  const input = usernameFirstIdentity(form);
  if (!input || input.matches(':disabled, [readonly]')) return;
  // The IAM resolver uses this same field for the account ID or alias.
  if (isAwsSignIn() && input.id === 'resolving_input' && input.type !== 'email') return;
  const next = Array.from(form.elements).some(control =>
    (control instanceof HTMLButtonElement || control instanceof HTMLInputElement)
    && control.type === 'submit' && isVisible(control) && safeLoginForm(form, control)
    && (commandMatches(control, nextStepName) || autocompleteField(input) === 'username'));
  if (next) return input;
}

function displayedAwsUsername(input: HTMLInputElement) {
  if (!isAwsSignIn()) return;
  const panel = input.closest('[data-testid="root-password-form"]');
  if (!panel) return;
  // AWS can restore the root-account email and render it as text instead of an input.
  const identities = Array.from(panel.querySelectorAll('strong')).filter(isVisible)
    .map(label => label.textContent?.trim() ?? '')
    .filter(value => value.length <= 512 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  if (identities.length === 1) return identities[0];
}

export function commandPasswordIdentity(input: HTMLInputElement) {
  if (!isCommandPassword(input)) return;
  const step = loginPage().__remoteaiLogin?.usernameStep;
  const displayed = displayedAwsUsername(input);
  if (step && performance.now() - step.at <= USERNAME_STEP_LIFETIME_MS && !isVisible(step.form)
    && (!displayed || displayed === step.username)) {
    return { username: step.username, continuationId: step.continuationId };
  }
  if (displayed) return { username: displayed };
}
