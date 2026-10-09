import type { LanguageAnalysis, LineLanguage, LyricsLanguage, SourceLanguageCode } from '../types/domain';

/**
 * Lightweight, offline language detection tuned for song lyrics.
 *
 * It scores every line against small marker vocabularies (words that are strongly
 * associated with exactly one language) plus a few script/diacritic cues, then derives
 * a song-level verdict. It deliberately ignores ambiguous words ("me", "no", "a") and
 * vocalisations ("la la la", "oh oh").
 */

type Lang = 'es' | 'en' | 'pt' | 'fr';
const LANGS: readonly Lang[] = ['es', 'en', 'pt', 'fr'];

const words = (s: string): Set<string> => new Set(s.split(/\s+/).filter(Boolean));

const MARKERS: Record<Lang, Set<string>> = {
  es: words(`
    de el y que es los las del se por con una un para tu te lo al pero más mas si yo ya muy está
    esta estoy estás eres soy tengo tienes tiene quiero quieres cuando como nada todo todos toda todas
    siempre nunca quien quién porque aunque hoy aquí aqui ahí ahi allí tan cada dos vida noche sé hay
    ser fue vez bien ni tú él ella nos les le sus mis tus están vas voy vamos dime dame bésame besame
    baila bailar cuerpo ojos cielo tiempo dónde donde qué cómo mucho mucha tanto contigo conmigo puedo
    puedes tenía tenia hacer dejar dejé perder volver este eso esto ese esa otro otra casa mundo siento
    sientes piel luna fuego fuerte loca loco mami papi hasta desde entre sobre después despues antes
    ahora mañana ayer cerca lejos verdad mentira gracias quizás quizas corazón corazon amor mío mio
    mía tuyo tuya solo sola estás entonces jamás jamas seré sere eras era éramos hoy dolor beso besos
    sabes sabe saber quedar queda quedo tenerte verte amarte olvidarte tenía amar decir dijo digo
    llorar lloro pensar pienso vivir vivo morir muero cantar canto ven vente vete anda déjame dejame
    mírame mirame llévame llevame quédate quedate
  `),
  en: words(`
    the and you your to of is in it that with for on be are this but not we they i i'm i'll i've i'd
    don't can't won't didn't isn't ain't what when know just like all got get go if so up out now one
    will would can have has do did was were been feel want need take make never ever she him her his
    our us there here where how why yes too only than then them from by at an as or about into over
    more gonna wanna gotta let's it's that's you're they're we're she's he's who whose which these
    those because cause though through night's every something nothing everything anything someone
    tonight tomorrow yesterday heart mind body soul eyes hands tears light dark dream dreams fire
    burn falling fall away stay stand walk run tell said say says think thought remember forget
    hold holding give gave find found look looking come coming came leave left keep kept life time
    world home again always maybe still even before after down back
  `),
  pt: words(`
    você voce não nao uma também tambem eu meu minha coração coracao mais obrigado saudade ele com
    então entao pra pro dele dela seu sua nós aqui muito estou tô tá vou vai sim porque
    quando quero amo saudades
  `),
  fr: words(`
    je tu il elle nous vous ils elles le la les un une des du de au aux et est ce cette ces cet que qui
    dont pas ne ni plus pour dans par avec sur sous chez vers sans mais ou où comme tout tous toute toutes
    rien jamais toujours encore déjà aussi alors quand quoi pourquoi parce très bien mon ma mes ton ta tes
    son sa ses notre votre nos vos leur leurs moi toi lui eux suis sommes êtes sont être avoir ont fait
    faire dit veux veut peux peut faut vais allons allez aime aimer aimé amour cœur coeur vie nuit jour
    soleil ciel mer larmes monde temps fois tête âme yeux mains bras vent pluie reviens reste viens
    chanson danse danser dansons petit petite belle beau jolie oui merci
  `),
};

/**
 * Each marker word votes with weight 1 / (number of languages that list it), so words shared
 * between languages ("de", "que", "tu", "un") count for little while exclusive ones count fully.
 */
const WEIGHTS = new Map<string, Partial<Record<Lang, number>>>();
for (const lang of LANGS) {
  for (const word of MARKERS[lang]) {
    const entry = WEIGHTS.get(word) ?? {};
    entry[lang] = 1;
    WEIGHTS.set(word, entry);
  }
}
for (const entry of WEIGHTS.values()) {
  const owners = Object.keys(entry) as Lang[];
  owners.forEach((lang) => (entry[lang] = 1 / owners.length));
}

/**
 * Words that are real but also turn up in vocalisations or other languages ("la la la", "mi" in
 * Italian, "en" in Dutch): weak evidence only. Truly ambiguous words ("me", "no", "a", "he", "on")
 * are simply absent from every list.
 */
const WEAK: Partial<Record<Lang, Set<string>>> = { es: words('en mi la'), fr: words('en la') };

const VOCABLES = words(`
  la na oh ooh oooh ah aah ahh uh mm mmm hmm eh ey yeah yeh yea hey whoa woah woo ay ayy ayay da doo
  sha ba ha hah ho uh-huh mhm ooooh ohh ohhh lalala nanana yo-ho hoo hu ooo
`);

const SPANISH_CHARS_STRONG = /[ñ¿¡]/gu;
// "é" is deliberately absent: it is just as common in French as in Spanish.
const SPANISH_ACCENTS = /[áíóú]/gu;
const PT_CHARS = /[ãõ]/gu;
const FR_CHARS = /[èêùœàâîôûëï]/gu;
// French elisions: l'amour, j'ai, qu'il, c'est, d'un, n'est, t'aime...
const FR_ELISION = /^(?:j|l|d|n|c|m|t|qu|jusqu|lorsqu|puisqu)'[\p{L}]+$/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
const ANY_LETTER = /\p{L}/u;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, ' ')
    .replace(/’/g, "'")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

function isVocable(token: string): boolean {
  return VOCABLES.has(token) || /^(?:la|na|oh|ah|ay|da|ooh?|uh|ha|ho)+$/u.test(token);
}

/** True when a line carries no real words (blank, symbols, or only vocalisations). */
export function isVocableOnly(text: string): boolean {
  if (!ANY_LETTER.test(text)) return true;
  const toks = tokenize(text);
  return toks.length === 0 || toks.every(isVocable);
}

type LineScores = Record<Lang, number>;

function scoreLine(text: string): LineScores {
  const scores: LineScores = { es: 0, en: 0, pt: 0, fr: 0 };
  const lower = text.toLowerCase();

  for (const token of tokenize(text)) {
    if (isVocable(token)) continue;
    if (/^[a-z]+'(?:t|s|m|ll|re|ve|d)$/u.test(token)) scores.en += 1;
    if (FR_ELISION.test(token)) scores.fr += 1;
    let weak = false;
    for (const lang of LANGS) {
      if (WEAK[lang]?.has(token)) {
        scores[lang] += 0.5;
        weak = true;
      }
    }
    if (weak) continue;
    const votes = WEIGHTS.get(token);
    if (votes) for (const lang of LANGS) scores[lang] += votes[lang] ?? 0;
  }

  scores.es += (lower.match(SPANISH_CHARS_STRONG)?.length ?? 0) * 2;
  scores.es += Math.min(2, (lower.match(SPANISH_ACCENTS)?.length ?? 0) * 0.75);
  scores.pt += (lower.match(PT_CHARS)?.length ?? 0) * 2;
  scores.pt += (lower.match(/ç/gu)?.length ?? 0) * 0.75;
  scores.fr += Math.min(3, (lower.match(FR_CHARS)?.length ?? 0) * 1.5);
  scores.fr += (lower.match(/ç/gu)?.length ?? 0) * 0.75;

  // Weak words alone ("en", "la") are not enough evidence.
  for (const lang of LANGS) if (scores[lang] > 0 && scores[lang] < 1 && WEAK[lang]) scores[lang] = 0;
  return scores;
}

/**
 * Verdict for one line. Ties favour the translatable language (a line containing Spanish or
 * French is worth translating), but a Spanish/French tie is "unknown" rather than a guess.
 */
export function detectLineLanguage(text: string): LineLanguage {
  if (!ANY_LETTER.test(text)) return 'unknown';
  const letters = [...text].filter((c) => ANY_LETTER.test(c));
  const nonLatin = letters.filter((c) => !LATIN_LETTER.test(c)).length;
  if (letters.length > 0 && nonLatin / letters.length > 0.5) return 'other';
  if (isVocableOnly(text)) return 'unknown';

  const scores = scoreLine(text);
  const best = Math.max(...LANGS.map((l) => scores[l]));
  if (best < 1) return 'unknown';
  const winners = LANGS.filter((l) => scores[l] === best);

  if (winners.includes('es') && winners.includes('fr')) return 'unknown';
  if (winners.includes('es')) return 'es';
  if (winners.includes('fr') && winners.every((l) => l === 'fr' || l === 'en')) return 'fr';
  if (winners.length === 1) return winners[0] === 'en' ? 'en' : winners[0] === 'pt' ? 'other' : 'unknown';
  return 'unknown';
}

export const ANALYSIS_THRESHOLDS = {
  /** Share of lines in a translatable language at which the song counts as that language. */
  foreign: 0.8,
  /** Below this share the song is treated as English. */
  english: 0.1,
  /** Share of other-language lines at which the song is "other". */
  other: 0.4,
} as const;

const SONG_LANGUAGE: Record<SourceLanguageCode, LyricsLanguage> = { es: 'spanish', fr: 'french' };

/** Classifies a whole song and every line in it. */
export function analyzeLyrics(lines: ReadonlyArray<{ text: string }>): LanguageAnalysis {
  const lineLanguages = lines.map((l) => detectLineLanguage(l.text));
  const count = (lang: LineLanguage) => lineLanguages.filter((l) => l === lang).length;
  const es = count('es');
  const fr = count('fr');
  const en = count('en');
  const other = count('other');
  const foreign = es + fr;
  const classified = foreign + en + other;

  if (classified === 0) return { language: 'unknown', lineLanguages, foreignShare: 0, sourceLanguage: null };

  const foreignShare = foreign / classified;
  const sourceLanguage: SourceLanguageCode | null = foreign === 0 ? null : es >= fr ? 'es' : 'fr';

  let language: LyricsLanguage;
  if (other / classified >= ANALYSIS_THRESHOLDS.other) language = 'other';
  else if (foreignShare >= ANALYSIS_THRESHOLDS.foreign && sourceLanguage) {
    // A song split between Spanish and French is "mixed", not either one.
    const minor = Math.min(es, fr);
    language = minor / foreign > 0.25 ? 'mixed' : SONG_LANGUAGE[sourceLanguage];
  } else if (foreignShare < ANALYSIS_THRESHOLDS.english) language = en > 0 ? 'english' : 'unknown';
  else language = 'mixed';

  return { language, lineLanguages, foreignShare, sourceLanguage };
}

/**
 * Decides, per line, whether it should be sent to the translation provider.
 * English lines are never translated (no "slightly different English").
 * `forced` is a language the user pinned in Settings (null = auto).
 */
export function selectLinesToTranslate(
  lines: ReadonlyArray<{ text: string }>,
  analysis: LanguageAnalysis,
  forced: SourceLanguageCode | null,
): boolean[] {
  const foreignSong = forced !== null || analysis.language === 'spanish' || analysis.language === 'french';
  return lines.map((line, i) => {
    if (isVocableOnly(line.text)) return false;
    const lang = analysis.lineLanguages[i];
    if (lang === 'es' || lang === 'fr') return true;
    if (lang === 'unknown') return foreignSong;
    return false;
  });
}

export function needsTranslation(analysis: LanguageAnalysis, forced: SourceLanguageCode | null): boolean {
  return forced !== null || analysis.language === 'spanish' || analysis.language === 'french' || analysis.language === 'mixed';
}

/** The language to tell a translation provider: the pinned one, else the dominant one, else null (auto-detect). */
export function sourceForTranslation(
  analysis: LanguageAnalysis,
  selected: readonly boolean[],
  forced: SourceLanguageCode | null,
): SourceLanguageCode | null {
  if (forced) return forced;
  const used = new Set(analysis.lineLanguages.filter((l, i) => selected[i] && (l === 'es' || l === 'fr')));
  if (used.size > 1) return null;
  return [...used][0] === 'es' || [...used][0] === 'fr' ? ([...used][0] as SourceLanguageCode) : analysis.sourceLanguage;
}
