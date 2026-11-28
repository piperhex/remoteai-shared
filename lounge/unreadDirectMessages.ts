import { historyKey } from './archive';
import { quoteMessage, type LoungeReply } from './reply';
import type { LoungeMessage } from './types';

interface UnreadDirectMessage {
  reference: LoungeReply;
  sentAt: string;
  time: number;
}

type Notification = UnreadDirectMessage & { key: string };

/** Keeps one small preview per live unread message, independent of the bounded live transcript. */
export class UnreadDirectMessages {
  private messages = new Map<string, UnreadDirectMessage>();
  private sorted?: Notification[];

  add(message: LoungeMessage) {
    const key = historyKey(message);
    if (this.messages.has(key)) return;
    this.messages.set(key, {
      reference: quoteMessage(message), sentAt: message.sentAt, time: Date.parse(message.sentAt),
    });
    this.sorted = undefined;
  }

  clear() { this.messages.clear(); this.sorted = undefined; }

  private remove(key: string) {
    const removed = this.messages.delete(key);
    if (removed) this.sorted = undefined;
    return removed;
  }

  read(message: LoungeMessage) { this.remove(historyKey(message)); }

  readConversation(peer: string, through = Infinity) {
    if (!peer) return false;
    let changed = false;
    for (const [key, entry] of this.messages) {
      if (entry.reference.senderId === peer && entry.time <= through) {
        changed = this.remove(key) || changed;
      }
    }
    return changed;
  }

  discardPeers(blocked?: string[], muted?: string[]) {
    const excluded = new Set([...(blocked ?? []), ...(muted ?? [])]);
    if (!excluded.size) return;
    for (const [key, entry] of this.messages) {
      if (excluded.has(entry.reference.senderId)) this.remove(key);
    }
  }

  notifications(): readonly Notification[] {
    return this.sorted ??= Array.from(this.messages, ([key, entry]) => ({ key, ...entry })).reverse()
      .sort((first, second) => second.time - first.time);
  }
}
