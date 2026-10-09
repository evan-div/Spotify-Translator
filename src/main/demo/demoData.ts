/**
 * DEMO / DEVELOPMENT DATA ONLY.
 * All lyrics below are short invented text written for this project, not real songs.
 * Nothing in this folder is imported by production code paths; it is only wired up when demo mode is on.
 */
import type { MediaType, SpotifyTrack } from '@shared/types/domain';

export interface DemoLine {
  /** Start time in ms; omitted for unsynced songs. */
  at?: number;
  text: string;
  /** English translation for Spanish lines. */
  en?: string;
}

export interface DemoEntry {
  mediaType: MediaType;
  track: SpotifyTrack | null;
  /** null = the lyrics provider finds nothing. */
  lyrics: DemoLine[] | null;
  /** Ad/podcast entries are only meant to demonstrate empty states. */
  durationMs: number;
}

const artwork = (from: string, to: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`,
  )}`;

function track(id: string, title: string, artists: string[], album: string, durationMs: number, colors: [string, string]): SpotifyTrack {
  return { id, key: id, title, artists, album, artworkUrl: artwork(...colors), durationMs, isLocal: false };
}

const luces: DemoLine[] = [
  { at: 4000, text: 'Las luces de la ciudad se encienden', en: 'The city lights are switching on' },
  { at: 9500, text: 'y tu nombre se me escapa entre los labios', en: 'and your name slips out between my lips' },
  { at: 15000, text: 'No sé qué hacer con tanto silencio', en: "I don't know what to do with so much silence" },
  { at: 20500, text: 'si tú ya no estás aquí', en: "if you're no longer here" },
  { at: 26000, text: '' },
  { at: 30000, text: 'Todavía te quiero', en: 'I still love you' },
  { at: 34500, text: 'aunque no estés aquí', en: "even though you're not here" },
  { at: 39000, text: 'Todavía te quiero', en: 'I still love you' },
  { at: 43500, text: 'aunque no vuelvas a mí', en: 'even if you never come back to me' },
  { at: 49000, text: 'Camino sin rumbo por la avenida', en: 'I walk aimlessly down the avenue' },
  { at: 54500, text: 'buscando tu risa en cada esquina', en: 'looking for your laughter on every corner' },
  { at: 60000, text: 'La luna me guiña, cómplice y cansada', en: 'The moon winks at me, tired and complicit' },
  { at: 65500, text: 'y yo le prometo que ya te olvidé', en: "and I promise her that I've already forgotten you" },
  { at: 71000, text: 'Todavía te quiero', en: 'I still love you' },
  { at: 75500, text: 'aunque no estés aquí', en: "even though you're not here" },
  { at: 80000, text: 'Todavía te quiero', en: 'I still love you' },
  { at: 84500, text: 'aunque no vuelvas a mí', en: 'even if you never come back to me' },
  { at: 92000, text: 'Ay, ay, ay' },
  { at: 97000, text: 'Todavía te quiero', en: 'I still love you' },
];

const lumieres: DemoLine[] = [
  { at: 3000, text: "Les lumières de la ville s'allument", en: 'The city lights are coming on' },
  { at: 8500, text: 'et ton prénom me revient en silence', en: 'and your first name comes back to me in silence' },
  { at: 14000, text: 'Je ne sais pas quoi faire de tout ce vide', en: "I don't know what to do with all this emptiness" },
  { at: 19500, text: "si tu n'es plus là", en: "if you're no longer here" },
  { at: 25000, text: '' },
  { at: 29000, text: "Je t'aime encore", en: 'I still love you' },
  { at: 33500, text: 'même si tu es parti', en: "even though you've gone" },
  { at: 38000, text: "Je t'aime encore", en: 'I still love you' },
  { at: 42500, text: 'même si tu ne reviens pas', en: "even if you never come back" },
];

const tides: DemoLine[] = [
  { at: 3000, text: 'Streetlights hum a quiet tune' },
  { at: 8000, text: "and I'm walking with the tide" },
  { at: 13000, text: 'Every window holds a memory' },
  { at: 18000, text: "of the summer we couldn't hide" },
  { at: 24000, text: '' },
  { at: 28000, text: 'Carry me home, carry me slow' },
  { at: 33000, text: "there's nowhere else I'd rather go" },
  { at: 38000, text: 'Carry me home, carry me slow' },
];

const girasoles: DemoLine[] = [
  { text: 'Tengo un corazón de cristal', en: 'I have a heart made of glass' },
  { text: 'que se rompe con el viento', en: 'that breaks in the wind' },
  { text: 'pero brilla cuando sale el sol', en: 'but shines when the sun comes out' },
  { text: 'y me olvido del tormento', en: 'and I forget the torment' },
  { text: '' },
  { text: 'Girasoles en la ventana', en: 'Sunflowers in the window' },
  { text: 'miran siempre hacia la luz', en: 'always looking toward the light' },
  { text: 'yo los sigo cada mañana', en: 'I follow them every morning' },
  { text: 'con mi taza y mi inquietud', en: 'with my cup and my restlessness' },
];

const baila: DemoLine[] = [
  { at: 3000, text: 'Baila conmigo esta noche', en: 'Dance with me tonight' },
  { at: 8000, text: "Come on, let's go, don't stop" },
  { at: 13000, text: 'que la música nos lleva lejos', en: 'because the music carries us far away' },
  { at: 18000, text: 'Feel the rhythm in your soul' },
  { at: 23000, text: 'Ven, ven, ven, no tengas miedo', en: "Come, come, come, don't be afraid" },
  { at: 28000, text: 'Just take my hand and dance with me' },
  { at: 33000, text: 'Baila conmigo esta noche', en: 'Dance with me tonight' },
];

export const DEMO_ENTRIES: DemoEntry[] = [
  {
    mediaType: 'track',
    track: track('demo-spanish-synced', 'Luces de Medianoche', ['Marea Azul'], 'Ciudad Dormida', 110_000, ['#ff7e5f', '#6a3093']),
    lyrics: luces,
    durationMs: 110_000,
  },
  {
    mediaType: 'track',
    track: track('demo-english-synced', 'Neon Tides', ['The Glass Harbor'], 'Slow Coast', 60_000, ['#36d1dc', '#5b86e5']),
    lyrics: tides,
    durationMs: 60_000,
  },
  {
    mediaType: 'track',
    track: track('demo-spanish-plain', 'Corazón de Cristal', ['Luna y los Girasoles'], 'Jardín de Invierno', 150_000, ['#f6d365', '#fda085']),
    lyrics: girasoles,
    durationMs: 150_000,
  },
  {
    mediaType: 'track',
    track: track('demo-mixed', 'Baila Conmigo', ['Dúo Tropical', 'Kid Marlowe'], 'Verano Eterno', 50_000, ['#11998e', '#38ef7d']),
    lyrics: baila,
    durationMs: 50_000,
  },
  {
    mediaType: 'track',
    track: track('demo-french-synced', 'Lumières de Minuit', ['Marée Douce'], 'Ville Endormie', 50_000, ['#4776e6', '#8e54e9']),
    lyrics: lumieres,
    durationMs: 50_000,
  },
  {
    mediaType: 'track',
    track: track('demo-no-lyrics', 'Interludio Instrumental', ['Orquesta del Faro'], 'Marejada', 45_000, ['#485563', '#29323c']),
    lyrics: null,
    durationMs: 45_000,
  },
  { mediaType: 'ad', track: null, lyrics: null, durationMs: 15_000 },
  {
    mediaType: 'episode',
    track: {
      id: 'demo-episode',
      key: 'episode:demo-episode',
      title: 'Aprender español con canciones',
      artists: ['Demo Podcast'],
      album: 'Demo Podcast',
      artworkUrl: artwork('#834d9b', '#d04ed6'),
      durationMs: 60_000,
      isLocal: false,
    },
    lyrics: null,
    durationMs: 60_000,
  },
];

/** Line text → English, for the demo translation provider. */
export const DEMO_TRANSLATIONS: ReadonlyMap<string, string> = new Map(
  [luces, girasoles, baila, lumieres].flatMap((song) => song.flatMap((l) => (l.en ? [[l.text, l.en] as const] : []))),
);
