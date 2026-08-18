import { describe, it, expect, vi, afterEach } from 'vitest';
import { DuelVoice } from '../DuelVoice';

function fakeLink() {
  const remoteTrackHandlers: Array<(stream: MediaStream) => void> = [];
  return {
    addMicTrack: vi.fn(),
    onRemoteTrack: (h: (stream: MediaStream) => void) => remoteTrackHandlers.push(h),
    deliverRemoteStream: (stream: MediaStream) => remoteTrackHandlers.forEach((h) => h(stream)),
  };
}

function fakeAudioTrack(): MediaStreamTrack {
  return { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DuelVoice', () => {
  it('start() requests a real mic stream and adds it to the link, triggering renegotiation', async () => {
    const track = fakeAudioTrack();
    const stream = fakeStream([track]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const link = fakeLink();
    const voice = new DuelVoice(link as any);
    const ok = await voice.start();

    expect(ok).toBe(true);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(link.addMicTrack).toHaveBeenCalledWith(stream);
    expect(voice.isActive).toBe(true);
  });

  it('start() resolves false (not throws) when mic permission is denied — a duel must never be blocked on voice', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const link = fakeLink();
    const voice = new DuelVoice(link as any);
    await expect(voice.start()).resolves.toBe(false);
    expect(voice.isActive).toBe(false);
  });

  it('toggleMute() disables the real outgoing track rather than stopping it (un-mute needs no new permission prompt)', async () => {
    const track = fakeAudioTrack();
    const stream = fakeStream([track]);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });

    const link = fakeLink();
    const voice = new DuelVoice(link as any);
    await voice.start();

    expect(voice.toggleMute()).toBe(true);
    expect(track.enabled).toBe(false);
    expect(voice.toggleMute()).toBe(false);
    expect(track.enabled).toBe(true);
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('a real incoming remote track is forwarded to onRemoteStream listeners', () => {
    const link = fakeLink();
    const voice = new DuelVoice(link as any);
    const received: MediaStream[] = [];
    voice.onRemoteStream((s) => received.push(s));
    const remote = fakeStream([]);
    link.deliverRemoteStream(remote);
    expect(received).toEqual([remote]);
  });

  it('stop() real-stops every local track', async () => {
    const track = fakeAudioTrack();
    const stream = fakeStream([track]);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });

    const link = fakeLink();
    const voice = new DuelVoice(link as any);
    await voice.start();
    voice.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(voice.isActive).toBe(false);
  });
});
