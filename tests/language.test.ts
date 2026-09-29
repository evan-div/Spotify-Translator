import { describe, expect, it } from 'vitest';
import {
  analyzeLyrics,
  detectLineLanguage,
  isVocableOnly,
  needsTranslation,
  selectLinesToTranslate,
} from '@shared/utils/language';

const lines = (...texts: string[]) => texts.map((text) => ({ text }));

describe('line language detection', () => {
  it('detects Spanish', () => {
    expect(detectLineLanguage('Todavía te quiero aunque no estés aquí')).toBe('es');
    expect(detectLineLanguage('¿Dónde estás corazón?')).toBe('es');
  });
  it('detects English', () => {
    expect(detectLineLanguage("I don't know what to do with you")).toBe('en');
    expect(detectLineLanguage('Carry me home, carry me slow')).toBe('en');
  });
  it('treats vocalisations and blanks as unknown', () => {
    expect(detectLineLanguage('La la la la')).toBe('unknown');
    expect(detectLineLanguage('Oh oh oh')).toBe('unknown');
    expect(detectLineLanguage('')).toBe('unknown');
    expect(detectLineLanguage('♪')).toBe('unknown');
    expect(isVocableOnly('Ay, ay, ay')).toBe(true);
    expect(isVocableOnly('Ay, mi amor')).toBe(false);
  });
  it('does not call a line Spanish because of a lone ambiguous word', () => {
    expect(detectLineLanguage('Give me love')).not.toBe('es');
    expect(detectLineLanguage('No no no')).toBe('unknown');
  });
  it('flags Portuguese and non-Latin scripts as other', () => {
    expect(detectLineLanguage('Eu não sei o que fazer com você')).toBe('other');
    expect(detectLineLanguage('사랑해 너를 영원히')).toBe('other');
  });
});

describe('song language analysis', () => {
  it('classifies a Spanish song', () => {
    const a = analyzeLyrics(
      lines('Las luces de la ciudad se encienden', 'y tu nombre se me escapa entre los labios', 'No sé qué hacer con tanto silencio', '', 'Ay, ay, ay'),
    );
    expect(a.language).toBe('spanish');
    expect(a.spanishShare).toBe(1);
  });

  it('classifies an English song', () => {
    const a = analyzeLyrics(lines('Streetlights hum a quiet tune', "and I'm walking with the tide", 'Every window holds a memory'));
    expect(a.language).toBe('english');
  });

  it('classifies mixed Spanish/English songs', () => {
    const a = analyzeLyrics(
      lines('Baila conmigo esta noche', "Come on, let's go, don't stop", 'que la música nos lleva lejos', 'Feel the rhythm in your soul'),
    );
    expect(a.language).toBe('mixed');
    expect(needsTranslation(a, false)).toBe(true);
  });

  it('treats one stray Spanish line in an English song as English', () => {
    const many = Array.from({ length: 14 }, () => "I can't stop thinking about you and the way that we were");
    const a = analyzeLyrics(lines(...many, 'Te quiero mucho'));
    expect(a.language).toBe('english');
    expect(needsTranslation(a, false)).toBe(false);
  });

  it('classifies other languages', () => {
    const a = analyzeLyrics(lines('Eu não sei o que fazer', 'você é meu coração', 'não vou te esquecer'));
    expect(a.language).toBe('other');
    expect(needsTranslation(a, false)).toBe(false);
  });

  it('returns unknown for nothing classifiable', () => {
    expect(analyzeLyrics(lines('La la la', 'Oh oh', '')).language).toBe('unknown');
    expect(analyzeLyrics([]).language).toBe('unknown');
  });

  it('forcing Spanish always translates', () => {
    expect(needsTranslation(analyzeLyrics(lines('la la la')), true)).toBe(true);
  });
});

describe('which lines get translated', () => {
  const song = lines('Baila conmigo esta noche', "Come on, let's go, don't stop", '', 'Ay, ay, ay', 'Contigo');

  it('mixed songs: only Spanish lines', () => {
    const a = analyzeLyrics(song);
    expect(selectLinesToTranslate(song, a, false)).toEqual([true, false, false, false, true]);
  });

  it('Spanish songs: also short unclassified lines, but never blanks/vocalisations/English', () => {
    const spanish = lines('Todavía te quiero', 'aunque no estés aquí', 'Cielo', '', 'Ay, ay, ay', "Come on, let's go, don't stop", 'Camino sin rumbo por la avenida', 'buscando tu risa en cada esquina', 'La luna me guiña, cómplice y cansada');
    const a = analyzeLyrics(spanish);
    expect(a.language).toBe('spanish');
    expect(selectLinesToTranslate(spanish, a, false)).toEqual([true, true, true, false, false, false, true, true, true]);
  });
});
