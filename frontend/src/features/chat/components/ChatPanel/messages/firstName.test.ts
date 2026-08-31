import { expect, test } from 'vitest';
import { firstName } from './firstName';

test('takes the first word of a name, whatever the spacing', () => {
  const cases: [string, string][] = [
    ['Alex Fisher', 'Alex'],
    ['Ada Byron Lovelace', 'Ada'],
    ['  Alex   Fisher ', 'Alex'],
    /** A single word is left whole rather than blanked. */
    ['Alex', 'Alex'],
    /** Whitespace only falls back to the original. */
    ['   ', '   '],
  ];

  for (const [name, expected] of cases) {
    expect(firstName(name)).toBe(expected);
  }
});
