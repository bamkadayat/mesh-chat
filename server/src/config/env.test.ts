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

  it('rejects a port that is not a number', () => {
    expect(() => readServerConfig({ PORT: 'abc' })).toThrow(/positive integer/);
  });

  it('rejects a port that is not a whole number', () => {
    expect(() => readServerConfig({ PORT: '3001.5' })).toThrow(/positive integer/);
  });

  it('rejects a port of zero or below', () => {
    expect(() => readServerConfig({ PORT: '0' })).toThrow(/positive integer/);
    expect(() => readServerConfig({ PORT: '-1' })).toThrow(/positive integer/);
  });
});
