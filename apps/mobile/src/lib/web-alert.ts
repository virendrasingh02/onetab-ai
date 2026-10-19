/**
 * `Alert.alert` for the web build. react-native-web implements it as a no-op,
 * so every confirmation, error and choice in the app would silently vanish in
 * a browser. This maps the same arguments onto the browser's own dialogs:
 *
 * - no choice to make (no buttons, or a single one) → `alert`, then its handler;
 * - one action plus cancel → `confirm`;
 * - several actions → `prompt` with a numbered list.
 *
 * Platform-free (the dialogs are injected) so it is unit tested in Node.
 */
/** The parts of React Native's `AlertButton` this reads. */
export interface AlertButtonLike {
  text?: string;
  style?: string;
  onPress?: () => unknown;
}

export interface BrowserDialogs {
  alert(message: string): void;
  confirm(message: string): boolean;
  prompt(message: string, defaultValue?: string): string | null;
}

export function runWebAlert(
  dialogs: BrowserDialogs,
  title: string | null | undefined,
  message?: string | null,
  buttons?: readonly AlertButtonLike[],
): void {
  const text = [title, message].filter(Boolean).join('\n\n');
  const all = buttons ?? [];
  const cancel = all.find((b) => b.style === 'cancel');
  const actions = all.filter((b) => b.style !== 'cancel');

  if (actions.length === 0 || (actions.length === 1 && !cancel)) {
    dialogs.alert(text);
    (actions[0] ?? cancel)?.onPress?.();
    return;
  }

  if (actions.length === 1) {
    const action = (actions[0]?.text ?? 'continue').toLowerCase();
    if (dialogs.confirm(`${text}\n\nPress OK to ${action}.`))
      actions[0]?.onPress?.();
    else cancel?.onPress?.();
    return;
  }

  const menu = actions
    .map((action, index) => `${index + 1}. ${action.text ?? 'Option'}`)
    .join('\n');
  const answer = dialogs.prompt(`${text}\n\n${menu}\n\nEnter a number:`, '1');
  const choice = answer === null ? NaN : Number.parseInt(answer, 10);
  const picked = Number.isInteger(choice) ? actions[choice - 1] : undefined;
  if (picked) picked.onPress?.();
  else cancel?.onPress?.();
}
