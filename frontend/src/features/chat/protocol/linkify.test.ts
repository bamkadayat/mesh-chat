import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('leaves plain text as a single token', () => {
    expect(linkify('just a message')).toEqual([{ kind: 'text', value: 'just a message' }]);
  });

  it('returns nothing for empty text', () => {
    expect(linkify('')).toEqual([]);
  });

  it('finds an http or https URL', () => {
    for (const value of ['https://example.com', 'http://example.com']) {
      expect(linkify(value)).toEqual([{ kind: 'link', value }]);
    }
  });

  it('keeps the text around a URL', () => {
    expect(linkify('see https://example.com now')).toEqual([
      { kind: 'text', value: 'see ' },
      { kind: 'link', value: 'https://example.com' },
      { kind: 'text', value: ' now' },
    ]);
  });

  it('finds more than one URL', () => {
    expect(linkify('https://a.com and https://b.com')).toEqual([
      { kind: 'link', value: 'https://a.com' },
      { kind: 'text', value: ' and ' },
      { kind: 'link', value: 'https://b.com' },
    ]);
  });

  it('leaves trailing punctuation out of the link', () => {
    expect(linkify('go to https://example.com.')).toEqual([
      { kind: 'text', value: 'go to ' },
      { kind: 'link', value: 'https://example.com' },
      { kind: 'text', value: '.' },
    ]);
    expect(linkify('(https://example.com), next')).toEqual([
      { kind: 'text', value: '(' },
      { kind: 'link', value: 'https://example.com' },
      { kind: 'text', value: '), next' },
    ]);
  });

  it('keeps a path and query inside the link', () => {
    expect(linkify('https://example.com/a/b?c=1&d=2')).toEqual([
      { kind: 'link', value: 'https://example.com/a/b?c=1&d=2' },
    ]);
  });

  it('does not link javascript URLs', () => {
    expect(linkify('javascript:alert(1)')).toEqual([
      { kind: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('does not link other schemes', () => {
    for (const value of ['ftp://example.com', 'file:///etc/passwd', 'data:text/html,x']) {
      expect(linkify(value)).toEqual([{ kind: 'text', value }]);
    }
  });

  it('does not link a bare domain without a scheme', () => {
    expect(linkify('example.com is a site')).toEqual([
      { kind: 'text', value: 'example.com is a site' },
    ]);
  });

  it('leaves a malformed URL as plain text', () => {
    for (const value of ['https://[', 'http://%%']) {
      expect(linkify(value)).toEqual([{ kind: 'text', value }]);
    }
  });

  it('keeps the text around a malformed URL', () => {
    expect(linkify('try https://[ now')).toEqual([
      { kind: 'text', value: 'try https://[ now' },
    ]);
  });

  it('markup in message text stays text', () => {
    const tokens = linkify('<b>hi</b> https://example.com');
    expect(tokens[0]).toEqual({ kind: 'text', value: '<b>hi</b> ' });
  });
});
