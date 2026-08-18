import { describe, it, expect, vi } from 'vitest';
import { DuelChat } from '../DuelChat';

function fakeLink() {
  const messageHandlers: Array<(data: unknown) => void> = [];
  return {
    send: vi.fn(),
    onMessage: (h: (data: unknown) => void) => messageHandlers.push(h),
    deliver: (data: unknown) => messageHandlers.forEach((h) => h(data)),
  };
}

describe('DuelChat', () => {
  it('send() transmits over the same link and records the message as mine', () => {
    const link = fakeLink();
    const chat = new DuelChat(link as any);
    chat.send('good fight');
    expect(link.send).toHaveBeenCalledWith({ type: 'chat', text: 'good fight' });
    expect(chat.history).toEqual([expect.objectContaining({ from: 'me', text: 'good fight' })]);
  });

  it('ignores empty/whitespace-only messages — nothing sent, nothing recorded', () => {
    const link = fakeLink();
    const chat = new DuelChat(link as any);
    chat.send('   ');
    expect(link.send).not.toHaveBeenCalled();
    expect(chat.history).toHaveLength(0);
  });

  it('an incoming real chat message from the opponent is recorded and broadcast to listeners', () => {
    const link = fakeLink();
    const chat = new DuelChat(link as any);
    const seen: string[] = [];
    chat.onUpdate((messages) => seen.push(messages[messages.length - 1].text));
    link.deliver({ type: 'chat', text: 'nice combo' });
    expect(chat.history).toEqual([expect.objectContaining({ from: 'opponent', text: 'nice combo' })]);
    expect(seen).toEqual(['nice combo']);
  });

  it('a non-chat message on the same link (duel state/input traffic) is ignored, not mistaken for chat', () => {
    const link = fakeLink();
    const chat = new DuelChat(link as any);
    link.deliver({ type: 'state', host: {}, guest: {}, winner: null });
    expect(chat.history).toHaveLength(0);
  });

  it('truncates an oversized message rather than sending unbounded text over the wire', () => {
    const link = fakeLink();
    const chat = new DuelChat(link as any);
    chat.send('x'.repeat(500));
    const sentText = (link.send as any).mock.calls[0][0].text as string;
    expect(sentText.length).toBe(200);
  });
});
