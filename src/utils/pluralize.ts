/**
 * Pluralize a count noun by appending `s` (no inflection of the count itself). For nouns with
 * irregular plurals, spell the sentence out at the call site instead.
 *
 * @param count - The quantity; an unknown (`undefined`) count reads as plural.
 * @param noun - The singular noun (e.g. "recording day").
 * @returns The noun, pluralized when count !== 1.
 */
export function pluralize(count: number | undefined, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}
