import { invoke } from '../platform/localBackend';
import { subscribeGuiEvent } from '../conversation/webEvents';
import { CLI_GUI_EVENT, type CliChange, type CliTransport } from './types';

export const localCliTransport: CliTransport = {
  request: request => invoke('cli_gui_request', { request }),
  subscribeAccountChange: async listener => {
    const stops = await Promise.all([
      subscribeGuiEvent('codex-gui-account-changed', listener),
      subscribeGuiEvent<{ method: string }>('codex-gui-event', event => {
        if (event.method === 'claudeAccounts/changed') listener();
      }),
    ]);
    return () => stops.forEach(stop => stop());
  },
  subscribe: listener => subscribeGuiEvent<{ method: string; params?: CliChange }>('codex-gui-event', event => {
    if (event.method === CLI_GUI_EVENT) listener(event.params);
    if (event.method === 'claudeAccounts/changed') listener({ engine: 'claude', runtime: true });
  }),
};
