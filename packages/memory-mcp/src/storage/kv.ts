import type { KVNamespace } from '@cloudflare/workers-types';
import type { LLMMessage } from '../types.js';

export class KVStorage {
  constructor(private kv: KVNamespace) {}

  private getMessagesKey(sessionId: string): string {
    return `sessions:${sessionId}:messages`;
  }

  async getMessages(sessionId: string): Promise<LLMMessage[]> {
    const data = await this.kv.get(this.getMessagesKey(sessionId), 'text');
    if (!data) {
      return [];
    }

    // Parse JSONL format (one message per line)
    const lines = data.split('\n').filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line) as LLMMessage);
  }

  async saveMessages(sessionId: string, messages: LLMMessage[]): Promise<number> {
    // Store as JSONL for efficient appending
    const jsonl = messages.map((msg) => JSON.stringify(msg)).join('\n');

    await this.kv.put(this.getMessagesKey(sessionId), jsonl, {
      metadata: {
        updated_at: Date.now(),
        message_count: messages.length,
      },
    });

    return messages.length;
  }

  async appendMessages(sessionId: string, newMessages: LLMMessage[]): Promise<number> {
    const existing = await this.getMessages(sessionId);
    const all = [...existing, ...newMessages];
    return this.saveMessages(sessionId, all);
  }

  async deleteMessages(sessionId: string): Promise<void> {
    await this.kv.delete(this.getMessagesKey(sessionId));
  }

  async getMessageCount(sessionId: string): Promise<number> {
    const metadata = await this.kv.getWithMetadata(this.getMessagesKey(sessionId));
    if (metadata.metadata && typeof metadata.metadata === 'object') {
      const meta = metadata.metadata as { message_count?: number };
      return meta.message_count || 0;
    }
    // Fallback: count messages
    const messages = await this.getMessages(sessionId);
    return messages.length;
  }
}
