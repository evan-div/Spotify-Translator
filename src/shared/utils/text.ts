/**
 * Text normalisation and fuzzy matching for track metadata.
 * Everything here is pure so it can be unit tested exhaustively.
 */

const VERSION_KEYWORDS = [
  'feat',
  'ft',
  'featuring',
  'remaster',
  'remastered',
  'remasterizado',
  'remasterizada',
  'live',
  'en vivo',
  'radio edit',
  'radio version',
  'edit',
  'deluxe',
  'version',
  'versión',
  'versao',
  'mono',
  'stereo',
  'acoustic',
  'acústico',
  'acustico',
  'explicit',
  'bonus',
  'single',
  'album',
  'álbum',
  'anniversary',
  'expanded',
  'edición',
  'edicion',
  'from',
  'soundtrack',
  'original motion picture',
];

const KEYWORD_SOURCE = VERSION_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
/** Bracketed segments that only describe a version, e.g. "(feat. X)" or "[2011 Remaster]". */
const BRACKET_VERSION_RE = new RegExp(`\\s*[(\\[][^)\\]]*\\b(?:${KEYWORD_SOURCE})\\b[^)\\]]*[)\\]]`, 'giu');
/** Trailing " - 2011 Remaster" style suffixes. */
const DASH_VERSION_RE = new RegExp(`\\s+[-–—]\\s+[^-–—]*\\b(?:${KEYWORD_SOURCE})\\b.*$`, 'iu');
/** Trailing "feat. X" without brackets. */
const BARE_FEAT_RE = /\s+(?:feat\.?|ft\.?|featuring)\s+.*$/iu;
const ALL_BRACKETS_RE = /\s*[([][^)\]]*[)\]]/gu;

export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

/** Lowercase, accent-free, punctuation-free form used only for comparing strings. */
export function normalizeForMatch(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes version noise (feat., remaster, live, radio edit, deluxe, parenthetical versions)
 * while keeping the original casing/accents, so the result is suitable for sending to search APIs.
 */
export function cleanTitle(raw: string): string {
  let title = raw.trim();
  let previous: string;
  do {
    previous = title;
    title = title.replace(BRACKET_VERSION_RE, '');
    title = title.replace(DASH_VERSION_RE, '');
    title = title.replace(BARE_FEAT_RE, '');
    title = title.trim();
  } while (title !== previous);
  return title || raw.trim();
}

/** Title with every parenthetical removed; a more aggressive fallback for searching. */
export function aggressiveTitle(raw: string): string {
  const cleaned = cleanTitle(raw).replace(ALL_BRACKETS_RE, '').replace(/\s+[-–—]\s+.*$/u, '').trim();
  return cleaned || cleanTitle(raw);
}

export function normalizeTitle(raw: string): string {
  return normalizeForMatch(cleanTitle(raw));
}

/** Distinct, ordered search variants: cleaned title first, then the aggressive one. */
export function titleVariants(raw: string): string[] {
  const variants = [cleanTitle(raw), aggressiveTitle(raw)];
  return variants.filter((v, i) => v.length > 0 && variants.indexOf(v) === i);
}

const ARTIST_SPLIT_RE = /\s*(?:,|;|\/|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b|\by\b|\band\b|\bx\b)\s*/iu;

/** Splits a combined artist string ("A, B feat. C") into individual normalised names. */
export function splitArtists(combined: string): string[] {
  return combined
    .split(ARTIST_SPLIT_RE)
    .map(normalizeForMatch)
    .filter((a) => a.length > 0);
}

export function normalizeArtist(raw: string): string {
  return normalizeForMatch(raw.replace(BARE_FEAT_RE, ''));
}

function tokens(s: string): string[] {
  return s.split(' ').filter(Boolean);
}

function containsWholeWords(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/** 0..1 similarity between two titles after cleaning + normalisation. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const aggressiveA = normalizeForMatch(aggressiveTitle(a));
  const aggressiveB = normalizeForMatch(aggressiveTitle(b));
  if (aggressiveA && aggressiveA === aggressiveB) return 0.95;
  if (containsWholeWords(na, nb) || containsWholeWords(nb, na)) return 0.85;
  const ta = new Set(tokens(na));
  const tb = new Set(tokens(nb));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : (shared / union) * 0.9;
}

/**
 * How well a candidate's artist string matches the Spotify artist list.
 * 1 = primary artist matches, 0.8 = a secondary artist matches, 0 = no match.
 */
export function artistMatchScore(spotifyArtists: readonly string[], candidateArtist: string): number {
  const candidateNormalized = normalizeForMatch(candidateArtist);
  const candidateParts = splitArtists(candidateArtist);
  const wanted = spotifyArtists.map(normalizeArtist).filter(Boolean);
  let best = 0;
  wanted.forEach((artist, index) => {
    const hit =
      candidateParts.includes(artist) ||
      candidateNormalized === artist ||
      containsWholeWords(candidateNormalized, artist);
    if (hit) best = Math.max(best, index === 0 ? 1 : 0.8);
  });
  return best;
}

export function formatArtists(artists: readonly string[]): string {
  return artists.join(', ');
}
