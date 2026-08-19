import { describe, it, expect } from 'vitest';
import { encryptWithPassphrase, decryptWithPassphrase } from '../SaveSyncCrypto';

describe('encryptWithPassphrase / decryptWithPassphrase', () => {
  it('round-trips an arbitrary JSON-safe value exactly with the same passphrase', async () => {
    const value = { species: 'bear', hp: 72, unlockedAbilities: ['keen-ear', 'bear-swipe'] };
    const payload = await encryptWithPassphrase('correct horse battery staple', value);
    expect(await decryptWithPassphrase('correct horse battery staple', payload)).toEqual(value);
  });

  it('the stored payload is real ciphertext, not plaintext JSON — the passphrase itself never leaks into it either', async () => {
    const payload = await encryptWithPassphrase('my-secret-phrase', { secret: 'do-not-leak-this-string' });
    expect(payload).not.toContain('do-not-leak-this-string');
    expect(payload).not.toContain('my-secret-phrase');
    const parsed = JSON.parse(payload);
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
  });

  it('decrypting with the WRONG passphrase returns null, not a throw or garbage data (real AES-GCM auth-tag rejection, not just a wrong key producing wrong bytes)', async () => {
    const payload = await encryptWithPassphrase('right-passphrase', { x: 1 });
    expect(await decryptWithPassphrase('wrong-passphrase', payload)).toBeNull();
  });

  it('a tampered ciphertext fails to decrypt even with the correct passphrase', async () => {
    const payload = await encryptWithPassphrase('a-real-passphrase', { x: 1 });
    const parsed = JSON.parse(payload);
    parsed.data = parsed.data.slice(0, -4) + (parsed.data.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(await decryptWithPassphrase('a-real-passphrase', JSON.stringify(parsed))).toBeNull();
  });

  it('decryptWithPassphrase returns null (not throws) for garbage input', async () => {
    expect(await decryptWithPassphrase('any-passphrase', 'not even json')).toBeNull();
  });

  it('two different passphrases produce two different ciphertexts for the same value (real distinct keys, not the same key with a passphrase tag appended)', async () => {
    const value = { same: 'value' };
    const payloadA = await encryptWithPassphrase('passphrase-one', value);
    const payloadB = await encryptWithPassphrase('passphrase-two', value);
    expect(JSON.parse(payloadA).data).not.toBe(JSON.parse(payloadB).data);
  });
});
