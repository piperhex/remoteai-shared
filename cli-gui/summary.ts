import type { CliSession, ExternalEngine } from './types';

export function cliSummary(session: CliSession): CliSession {
  return { id: session.id, engine: session.engine, title: session.title.slice(0, 500), cwd: session.cwd,
    model: session.model, effort: session.effort, status: session.status, updatedAt: session.updatedAt,
    archived: session.archived, permissions: [], permissionCount: session.permissionCount ?? session.permissions.length };
}
export const cliScope = (engine: ExternalEngine, archived: boolean, search = '') =>
  JSON.stringify([engine, archived, search]);
export const cliKey = (session: Pick<CliSession, 'engine' | 'id'>) => `${session.engine}:${session.id}`;
