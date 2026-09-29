import { describe, expect, it } from 'vitest';
import {
  artistMatchScore,
  cleanTitle,
  normalizeForMatch,
  normalizeTitle,
  splitArtists,
  titleSimilarity,
  titleVariants,
} from '@shared/utils/text';

describe('song title normalization', () => {
  it.each([
    ['Song Name - 2011 Remaster', 'Song Name'],
    ['Song Name - Remastered 2011', 'Song Name'],
    ['Song Name (feat. Someone Else)', 'Song Name'],
    ['Song Name (Radio Edit)', 'Song Name'],
    ['Song Name - Live at Wembley', 'Song Name'],
    ['Song Name [Deluxe Edition]', 'Song Name'],
    ['Song Name - En Vivo', 'Song Name'],
    ['Song Name (Remastered) - Single Version', 'Song Name'],
    ['Song Name ft. Other', 'Song Name'],
  ])('cleans %s', (raw, expected) => {
    expect(cleanTitle(raw)).toBe(expected);
  });

  it('keeps meaningful parentheticals', () => {
    expect(cleanTitle('(I Can\'t Get No) Satisfaction')).toBe("(I Can't Get No) Satisfaction");
    expect(cleanTitle('Dancing With Myself')).toBe('Dancing With Myself');
  });

  it('never returns an empty title', () => {
    expect(cleanTitle('(Live)')).toBe('(Live)');
  });

  it('folds accents, case and punctuation', () => {
    expect(normalizeForMatch("Bésame Mucho!")).toBe('besame mucho');
    expect(normalizeTitle("Don't Stop - 2011 Remaster")).toBe('dont stop');
    expect(normalizeForMatch('Rock & Roll')).toBe('rock and roll');
  });

  it('offers a cleaned and an aggressive search variant', () => {
    expect(titleVariants('Dákiti (Remix) - 2020 Remaster')).toEqual(['Dákiti (Remix)', 'Dákiti']);
    expect(titleVariants('Plain Title')).toEqual(['Plain Title']);
  });

  it('scores versions of the same song as very similar', () => {
    expect(titleSimilarity('Song Name - 2011 Remaster', 'Song Name')).toBe(1);
    expect(titleSimilarity('Bésame Mucho', 'Besame mucho')).toBe(1);
    expect(titleSimilarity('Song Name', 'Totally Different')).toBeLessThan(0.3);
  });
});

describe('artist matching', () => {
  it('splits combined artist strings', () => {
    expect(splitArtists('Bad Bunny, Jhay Cortez')).toEqual(['bad bunny', 'jhay cortez']);
    expect(splitArtists('Shakira feat. Maluma')).toEqual(['shakira', 'maluma']);
    expect(splitArtists('Juan y Pedro')).toEqual(['juan', 'pedro']);
  });

  it('matches the primary artist with full score', () => {
    expect(artistMatchScore(['Bad Bunny', 'Jhay Cortez'], 'Bad Bunny')).toBe(1);
    expect(artistMatchScore(['Bad Bunny'], 'Bad Bunny, Jhay Cortez')).toBe(1);
  });

  it('matches secondary artists with reduced score', () => {
    expect(artistMatchScore(['Bad Bunny', 'Jhay Cortez'], 'Jhay Cortez')).toBe(0.8);
  });

  it('ignores accents and case', () => {
    expect(artistMatchScore(['Beyoncé'], 'BEYONCE')).toBe(1);
    expect(artistMatchScore(['Rosalía'], 'rosalia')).toBe(1);
  });

  it('rejects unrelated artists', () => {
    expect(artistMatchScore(['Shakira'], 'Shakur')).toBe(0);
  });
});
