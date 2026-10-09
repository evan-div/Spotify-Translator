/**
 * Word handling for tap-a-word: splitting lyric lines into tappable words, normalising the
 * tapped word for lookup, and cleaning dictionary text. Pure, so it is easy to test.
 */

export interface TextSegment {
  text: string;
  isWord: boolean;
}

// A word: letters (with combining marks), optionally joined by an inner apostrophe or hyphen.
const WORD_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
const MAX_WORD_LENGTH = 40;

/** Splits text into alternating word / non-word segments; joining them reproduces the text. */
export function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(WORD_RE)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), isWord: false });
    segments.push({ text: match[0], isWord: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), isWord: false });
  return segments;
}

/** Lowercase, punctuation-free lookup form ("¿Quién?" → "quién"); null when there's no usable word. */
export function normalizeWord(raw: string): string | null {
  const cleaned = raw
    .normalize('NFC')
    .trim()
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '')
    .replace(/’/g, "'")
    .toLowerCase();
  if (!cleaned || cleaned.length > MAX_WORD_LENGTH) return null;
  return /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u.test(cleaned) ? cleaned : null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Vocabulary entry id: one per word per language ("es:querer"). */
export const vocabularyId = (language: string, word: string): string => `${language}:${word}`;

/** Dictionary definitions arrive as HTML; reduce to plain text safe to render. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

const FORM_OF_RE =
  /^(?:.*?\b(?:person|singular|plural|participle|gerund|imperative|subjunctive|indicative|conditional|future|preterite|imperfect|present|past|form|feminine|masculine|diminutive|augmentative|superlative|inflection|combining)\b.*?\bof\s+)(?:the\s+)?([\p{L}\p{M}]+)\s*\.?$/iu;

/**
 * If a definition just says "first-person singular present indicative of querer", returns
 * the lemma ("querer") so we can show the real meaning of the dictionary form.
 */
export function extractLemma(definition: string): string | null {
  const text = htmlToText(definition).split(/[;:]/)[0]?.trim() ?? '';
  const match = FORM_OF_RE.exec(text);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Short one-line gloss: the first couple of meanings of the first sense. */
export function shortGloss(senses: ReadonlyArray<{ meanings: string[] }>): string {
  return (senses[0]?.meanings ?? []).slice(0, 2).join('; ');
}
