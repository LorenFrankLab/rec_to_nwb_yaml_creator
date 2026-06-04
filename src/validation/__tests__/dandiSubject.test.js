import { describe, it, expect } from 'vitest';
import { isValidSpecies, idHasSlash } from '../dandiSubject';

describe('isValidSpecies (DANDI: Latin binomial or NCBI Taxon URI)', () => {
  it('accepts a Latin binomial', () => {
    expect(isValidSpecies('Rattus norvegicus')).toBe(true);
    expect(isValidSpecies('Mus musculus')).toBe(true);
  });

  it('accepts an NCBI Taxonomy URI', () => {
    expect(isValidSpecies('http://purl.obolibrary.org/obo/NCBITaxon_10116')).toBe(true);
  });

  it('rejects free text like "Rat" or "Long Evans"', () => {
    expect(isValidSpecies('Rat')).toBe(false);
    expect(isValidSpecies('Long Evans')).toBe(false);
  });

  it('rejects a lower-case genus', () => {
    expect(isValidSpecies('rattus norvegicus')).toBe(false);
    // (the bundled species list has "sus scrofa" — this would be flagged.)
    expect(isValidSpecies('sus scrofa')).toBe(false);
  });

  it('rejects an empty / whitespace / non-string value', () => {
    expect(isValidSpecies('')).toBe(false);
    expect(isValidSpecies('   ')).toBe(false);
    expect(isValidSpecies(undefined)).toBe(false);
    expect(isValidSpecies(null)).toBe(false);
  });

  it('tolerates surrounding whitespace on an otherwise-valid binomial', () => {
    expect(isValidSpecies('  Rattus norvegicus  ')).toBe(true);
  });
});

describe('idHasSlash (DANDI: subject_id / session_id must have no slashes)', () => {
  it('detects a slash', () => {
    expect(idHasSlash('remy/2023')).toBe(true);
    expect(idHasSlash('a/b/c')).toBe(true);
  });

  it('returns false for a slash-free id', () => {
    expect(idHasSlash('remy')).toBe(false);
    expect(idHasSlash('remy_20230622')).toBe(false);
  });

  it('returns false for non-string / empty values (handled by other rules)', () => {
    expect(idHasSlash('')).toBe(false);
    expect(idHasSlash(undefined)).toBe(false);
    expect(idHasSlash(null)).toBe(false);
  });
});
