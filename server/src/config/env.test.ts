import { describe, expect, it } from 'vitest';
import { readServerConfig } from './env';

describe('readServerConfig', () => {
  it('falls back to local defaults when nothing is set', () => {
    expect(readServerConfig({})).toEqual({
      port: 3001,
      clientOrigin: 'http://localhost:5173',
    });
  });

  it('reads the port and origin from the environment', () => {
    expect(readServerConfig({ PORT: '4000', CLIENT_ORIGIN: 'https://example.com' })).toEqual({
      port: 4000,
      clientOrigin: 'https://example.com',
    });
  });

  it('rejects a port that is not a positive whole number', () => {
    for (const PORT of ['abc', '3001.5', '0', '-1']) {
      expect(() => readServerConfig({ PORT })).toThrow(/positive integer/);
    }
  });
});
