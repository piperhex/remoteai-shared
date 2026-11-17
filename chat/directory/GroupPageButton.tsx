import { useState } from 'react';
import { uiText } from '../../localization/uiText';

export function GroupPageButton({ cursor, load, enabled = true, className }: {
  cursor?: string | null; load: (more: boolean) => Promise<void>; enabled?: boolean; className?: string;
}) {
  const [loading, setLoading] = useState(false);
  if (!enabled || cursor === null) return null;
  return <button type="button" className={className} disabled={loading} aria-busy={loading}
    onClick={() => {
      setLoading(true);
      void load(Boolean(cursor)).finally(() => setLoading(false));
    }}>{uiText(loading ? 'client.projectBrowser.loading' : 'client.chat.loadMore')}</button>;
}
