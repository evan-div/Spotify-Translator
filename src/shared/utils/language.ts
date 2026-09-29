import type { LanguageAnalysis, LineLanguage, LyricsLanguage } from '../types/domain';

/**
 * Lightweight, offline language detection tuned for song lyrics.
 *
 * It scores every line against small marker vocabularies (words that are strongly
 * associated with exactly one language) plus a few script/diacritic cues, then derives
 * a song-level verdict. It deliberately ignores ambiguous words ("me", "no", "a") and
 * vocalisations ("la la la", "oh oh").
 */

type Lang = 'es' | 'en' | 'pt' | 'fr';

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
    então entao pra pro dele dela seu sua nós nos aqui muito estou está tô tá vou vai sim porque
    quando quero amo te amo saudades
  `),
  fr: words(`
    je est les des une pas dans avec vous nous très tres mais qui mon ton être etre suis j'ai c'est
    l'amour moi toi pour et le du au aux cette sont fait comme mes tes ses ma ta sa
  `),
};

/**
 * Words that are Spanish but also common in English/other lyrics ("la la la", "mi" in Italian, "en"
 * in Dutch). They only count as weak evidence. Truly ambiguous words ("me", "no", "a", "he") are
 * simply absent from every list.
 */
const WEAK_SPANISH = words('en mi la');

const VOCABLES = words(`
  la na oh ooh oooh ah aah ahh uh mm mmm hmm eh ey yeah yeh yea hey whoa woah woo ay ayy ayay da doo
  sha ba ha hah ho uh-huh mhm ooooh ohh ohhh lalala nanana yo-ho hoo hu ooo
`);

const SPANISH_CHARS_STRONG = /[ñ¿¡]/gu;
const SPANISH_ACCENTS = /[áéíóú]/gu;
const PT_CHARS = /[ãõç]/gu;
const FR_CHARS = /[èêùœ]/gu;
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

interface LineScores {
  es: number;
  en: number;
  pt: number;
  fr: number;
}

function scoreLine(text: string): LineScores {
  const scores: LineScores = { es: 0, en: 0, pt: 0, fr: 0 };
  const lower = text.toLowerCase();

  for (const token of tokenize(text)) {
    if (isVocable(token)) continue;
    if (/^[a-z]+'(?:t|s|m|ll|re|ve|d)$/u.test(token)) scores.en += 1;
    if (WEAK_SPANISH.has(token)) {
      scores.es += 0.5;
      continue;
    }
    (Object.keys(MARKERS) as Lang[]).forEach((lang) => {
      if (MARKERS[lang].has(token)) scores[lang] += 1;
    });
  }

  scores.es += (lower.match(SPANISH_CHARS_STRONG)?.length ?? 0) * 2;
  scores.es += Math.min(2, (lower.match(SPANISH_ACCENTS)?.length ?? 0) * 0.75);
  scores.pt += (lower.match(PT_CHARS)?.length ?? 0) * 2;
  scores.fr += (lower.match(FR_CHARS)?.length ?? 0) * 2;

  // Weak Spanish-only words alone ("en", "la") are not enough evidence on their own.
  if (scores.es > 0 && scores.es < 1) scores.es = 0;
  return scores;
}

export function detectLineLanguage(text: string): LineLanguage {
  if (!ANY_LETTER.test(text)) return 'unknown';
  const letters = [...text].filter((c) => ANY_LETTER.test(c));
  const nonLatin = letters.filter((c) => !LATIN_LETTER.test(c)).length;
  if (letters.length > 0 && nonLatin / letters.length > 0.5) return 'other';
  if (isVocableOnly(text)) return 'unknown';

  const { es, en, pt, fr } = scoreLine(text);
  const best = Math.max(es, en, pt, fr);
  if (best < 1) return 'unknown';
  // Spanish/English tie: a line containing Spanish is worth translating.
  if (es === best && es >= en && es >= pt && es >= fr) return 'es';
  if (en === best && en > es && en > pt && en > fr) return 'en';
  if (pt === best || fr === best) return es === best ? 'es' : 'other';
  return 'unknown';
}

export const ANALYSIS_THRESHOLDS = {
  spanish: 0.8,
  english: 0.1,
  other: 0.4,
} as const;

/** Classifies a whole song and every line in it. */
export function analyzeLyrics(lines: ReadonlyArray<{ text: string }>): LanguageAnalysis {
  const lineLanguages = lines.map((l) => detectLineLanguage(l.text));
  const count = (lang: LineLanguage) => lineLanguages.filter((l) => l === lang).length;
  const es = count('es');
  const en = count('en');
  const other = count('other');
  const classified = es + en + other;

  if (classified === 0) return { language: 'unknown', lineLanguages, spanishShare: 0 };

  const spanishShare = es / classified;
  let language: LyricsLanguage;
  if (other / classified >= ANALYSIS_THRESHOLDS.other) language = 'other';
  else if (spanishShare >= ANALYSIS_THRESHOLDS.spanish) language = 'spanish';
  else if (spanishShare < ANALYSIS_THRESHOLDS.english) language = en > 0 ? 'english' : 'unknown';
  else language = 'mixed';

  return { language, lineLanguages, spanishShare };
}

/**
 * Decides, per line, whether it should be sent to the translation provider.
 * English lines are never translated (no "slightly different English").
 */
export function selectLinesToTranslate(
  lines: ReadonlyArray<{ text: string }>,
  analysis: LanguageAnalysis,
  forceSpanish: boolean,
): boolean[] {
  const spanishSong = forceSpanish || analysis.language === 'spanish';
  return lines.map((line, i) => {
    if (isVocableOnly(line.text)) return false;
    const lang = analysis.lineLanguages[i];
    if (lang === 'es') return true;
    if (lang === 'unknown') return spanishSong;
    return false;
  });
}

export function needsTranslation(analysis: LanguageAnalysis, forceSpanish: boolean): boolean {
  return forceSpanish || analysis.language === 'spanish' || analysis.language === 'mixed';
}
