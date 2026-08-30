import { expect, test } from 'vitest';
import { firstName } from './firstName';

test('takes the first word of a full name', () => {
  expect(firstName('Alex Fisher')).toBe('Alex');
  expect(firstName('Ada Byron Lovelace')).toBe('Ada');
});

test('tolerates untidy spacing, which peers may send', () => {
  expect(firstName('  Alex   Fisher ')).toBe('Alex');
});

test('a single-word name is left whole rather than blanked', () => {
  expect(firstName('Alex')).toBe('Alex');
});

test('a name that is only whitespace falls back to the original', () => {
  expect(firstName('   ')).toBe('   ');
});
