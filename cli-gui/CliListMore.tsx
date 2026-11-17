import { useCliGui } from './context';
import { uiText } from '../localization/uiText';

export function CliListMore({ className }: { className?: string }) {
  const cli = useCliGui();
  if (!cli || !Object.values(cli.state.listMore ?? {}).some(Boolean)) return null;
  return <button type="button" className={className} disabled={cli.state.listLoading}
    aria-busy={cli.state.listLoading} onClick={() => void cli.controller.loadMoreSessions()}>
    {uiText(cli.state.listLoading ? 'client.projectBrowser.loading' : 'client.chat.loadMore')}
  </button>;
}
