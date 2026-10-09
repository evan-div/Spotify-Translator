import { describe, expect, it } from 'vitest';
import {
  analyzeLyrics,
  detectLineLanguage,
  isVocableOnly,
  needsTranslation,
  selectLinesToTranslate,
  sourceForTranslation,
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
    expect(a.foreignShare).toBe(1);
    expect(a.sourceLanguage).toBe('es');
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
    expect(needsTranslation(a, null)).toBe(true);
  });

  it('treats one stray Spanish line in an English song as English', () => {
    const many = Array.from({ length: 14 }, () => "I can't stop thinking about you and the way that we were");
    const a = analyzeLyrics(lines(...many, 'Te quiero mucho'));
    expect(a.language).toBe('english');
    expect(needsTranslation(a, null)).toBe(false);
  });

  it('classifies other languages', () => {
    const a = analyzeLyrics(lines('Eu não sei o que fazer', 'você é meu coração', 'não vou te esquecer'));
    expect(a.language).toBe('other');
    expect(needsTranslation(a, null)).toBe(false);
  });

  it('returns unknown for nothing classifiable', () => {
    expect(analyzeLyrics(lines('La la la', 'Oh oh', '')).language).toBe('unknown');
    expect(analyzeLyrics([]).language).toBe('unknown');
  });

  it('forcing Spanish always translates', () => {
    expect(needsTranslation(analyzeLyrics(lines('la la la')), 'es')).toBe(true);
  });
});

describe('which lines get translated', () => {
  const song = lines('Baila conmigo esta noche', "Come on, let's go, don't stop", '', 'Ay, ay, ay', 'Contigo');

  it('mixed songs: only Spanish lines', () => {
    const a = analyzeLyrics(song);
    expect(selectLinesToTranslate(song, a, null)).toEqual([true, false, false, false, true]);
  });

  it('Spanish songs: also short unclassified lines, but never blanks/vocalisations/English', () => {
    const spanish = lines('Todavía te quiero', 'aunque no estés aquí', 'Cielo', '', 'Ay, ay, ay', "Come on, let's go, don't stop", 'Camino sin rumbo por la avenida', 'buscando tu risa en cada esquina', 'La luna me guiña, cómplice y cansada');
    const a = analyzeLyrics(spanish);
    expect(a.language).toBe('spanish');
    expect(selectLinesToTranslate(spanish, a, null)).toEqual([true, true, true, false, false, false, true, true, true]);
  });
});


describe('French', () => {
  const song = lines(
    "Les lumières de la ville s'allument",
    'et ton prénom me revient en silence',
    'Je ne sais pas quoi faire de tout ce vide',
    "si tu n'es plus là",
    "Je t'aime encore, même si tu es parti",
  );

  it('detects French lines', () => {
    expect(detectLineLanguage("Je t'aime encore")).toBe('fr');
    expect(detectLineLanguage('Il fait beau dans la ville aujourd’hui')).toBe('fr');
    expect(detectLineLanguage("L'amour est un oiseau rebelle")).toBe('fr');
    expect(detectLineLanguage('Ne me quitte pas')).toBe('fr');
  });

  it('keeps Spanish and French apart, including words they share', () => {
    expect(detectLineLanguage('No sé por qué te quiero tanto')).toBe('es');
    expect(detectLineLanguage('Todos los días pienso en ti')).toBe('es');
    expect(detectLineLanguage('Tous les jours je pense à toi')).toBe('fr');
    // Mostly shared vocabulary: must not be called French (or Spanish) with confidence.
    expect(['unknown', 'es']).toContain(detectLineLanguage('de la vida'));
  });

  it('does not treat é as evidence for either language', () => {
    expect(detectLineLanguage('été')).toBe('unknown');
    expect(detectLineLanguage('olvidé')).toBe('unknown');
  });

  it('classifies a French song and reports its language', () => {
    const a = analyzeLyrics(song);
    expect(a.language).toBe('french');
    expect(a.sourceLanguage).toBe('fr');
    expect(needsTranslation(a, null)).toBe(true);
    expect(selectLinesToTranslate(song, a, null)).toEqual([true, true, true, true, true]);
  });

  it('calls a song that is half Spanish, half French "mixed"', () => {
    const mix = lines('Todavía te quiero aunque no estés aquí', 'Siempre pienso en ti mi amor', "Je t'aime encore, même si tu es parti", 'Tous les jours je pense à toi');
    const a = analyzeLyrics(mix);
    expect(a.language).toBe('mixed');
    expect(selectLinesToTranslate(mix, a, null)).toEqual([true, true, true, true]);
    expect(sourceForTranslation(a, selectLinesToTranslate(mix, a, null), null)).toBeNull(); // let the provider detect per line
  });

  it('picks the single language to send to a provider', () => {
    const a = analyzeLyrics(song);
    const selected = selectLinesToTranslate(song, a, null);
    expect(sourceForTranslation(a, selected, null)).toBe('fr');
    expect(sourceForTranslation(a, selected, 'es')).toBe('es'); // a pinned language wins
  });

  it('an English song with one French phrase stays English, and a tiny one is honestly "mixed"', () => {
    const english = Array.from({ length: 14 }, () => "I can't stop thinking about you and the way that we were");
    expect(analyzeLyrics(lines(...english, "C'est la vie, mon amour")).language).toBe('english');
    expect(analyzeLyrics(lines("I can't stop thinking about you", 'and the way that we were', "C'est la vie, mon amour", 'every night I dream of you')).language).toBe('mixed');
  });

  it('forcing French translates unclassified lines', () => {
    const short = lines('Toi', 'Moi');
    const a = analyzeLyrics(short);
    expect(selectLinesToTranslate(short, a, 'fr')).toEqual([true, true]);
  });
});
