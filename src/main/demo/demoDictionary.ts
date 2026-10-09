/**
 * DEMO / DEVELOPMENT DATA ONLY. Short glosses written for this project, covering the demo lyrics.
 */
import type { SourceLanguageCode } from '@shared/types/domain';
import type { WordSense } from '@shared/types/library';
import type { DictionaryLookup, DictionaryProvider } from '../dictionary/DictionaryProvider';

type Entry = [partOfSpeech: string, ...meanings: string[]];

const ES: Record<string, Entry> = {
  luces: ['Noun', 'lights', 'plural of luz'],
  ciudad: ['Noun', 'city', 'town'],
  nombre: ['Noun', 'name'],
  escapa: ['Verb', 'third-person singular present indicative of escapar'],
  escapar: ['Verb', 'to escape', 'to slip away'],
  labios: ['Noun', 'lips'],
  silencio: ['Noun', 'silence', 'quiet'],
  quiero: ['Verb', 'first-person singular present indicative of querer'],
  querer: ['Verb', 'to want', 'to love (someone)'],
  aunque: ['Conjunction', 'although', 'even though', 'even if'],
  aquí: ['Adverb', 'here'],
  estés: ['Verb', 'second-person singular present subjunctive of estar'],
  estar: ['Verb', 'to be (location or temporary state)'],
  vuelvas: ['Verb', 'second-person singular present subjunctive of volver'],
  volver: ['Verb', 'to return', 'to come back'],
  camino: ['Noun', 'road', 'path', 'way'],
  rumbo: ['Noun', 'direction', 'course', 'bearing'],
  avenida: ['Noun', 'avenue', 'boulevard'],
  buscando: ['Verb', 'present participle of buscar'],
  buscar: ['Verb', 'to look for', 'to search'],
  risa: ['Noun', 'laughter', 'laugh'],
  esquina: ['Noun', 'corner (of a street)'],
  luna: ['Noun', 'moon'],
  guiña: ['Verb', 'third-person singular present indicative of guiñar'],
  guiñar: ['Verb', 'to wink'],
  cómplice: ['Noun', 'accomplice', 'partner in crime', 'confidant'],
  cansada: ['Adjective', 'tired (feminine)', 'weary'],
  prometo: ['Verb', 'first-person singular present indicative of prometer'],
  prometer: ['Verb', 'to promise'],
  olvidé: ['Verb', 'first-person singular preterite indicative of olvidar'],
  olvidar: ['Verb', 'to forget'],
  corazón: ['Noun', 'heart'],
  cristal: ['Noun', 'glass', 'crystal'],
  rompe: ['Verb', 'third-person singular present indicative of romper'],
  romper: ['Verb', 'to break', 'to tear'],
  viento: ['Noun', 'wind'],
  brilla: ['Verb', 'third-person singular present indicative of brillar'],
  brillar: ['Verb', 'to shine', 'to sparkle'],
  sol: ['Noun', 'sun'],
  tormento: ['Noun', 'torment', 'anguish'],
  girasoles: ['Noun', 'sunflowers', 'plural of girasol'],
  ventana: ['Noun', 'window'],
  miran: ['Verb', 'third-person plural present indicative of mirar'],
  mirar: ['Verb', 'to look at', 'to watch'],
  luz: ['Noun', 'light'],
  sigo: ['Verb', 'first-person singular present indicative of seguir'],
  seguir: ['Verb', 'to follow', 'to continue'],
  mañana: ['Noun', 'morning', 'tomorrow'],
  taza: ['Noun', 'cup', 'mug'],
  inquietud: ['Noun', 'restlessness', 'unease'],
  baila: ['Verb', 'third-person singular present indicative of bailar', 'imperative of bailar'],
  bailar: ['Verb', 'to dance'],
  conmigo: ['Pronoun', 'with me'],
  noche: ['Noun', 'night', 'evening'],
  música: ['Noun', 'music'],
  lleva: ['Verb', 'third-person singular present indicative of llevar'],
  llevar: ['Verb', 'to carry', 'to take', 'to wear'],
  lejos: ['Adverb', 'far', 'far away'],
  ven: ['Verb', 'imperative of venir'],
  venir: ['Verb', 'to come'],
  miedo: ['Noun', 'fear'],
};

const FR: Record<string, Entry> = {
  lumières: ['Noun', 'lights', 'plural of lumière'],
  lumière: ['Noun', 'light'],
  ville: ['Noun', 'city', 'town'],
  allument: ['Verb', 'third-person plural present indicative of allumer'],
  allumer: ['Verb', 'to light', 'to switch on'],
  prénom: ['Noun', 'first name', 'given name'],
  revient: ['Verb', 'third-person singular present indicative of revenir'],
  revenir: ['Verb', 'to come back', 'to return'],
  silence: ['Noun', 'silence'],
  sais: ['Verb', 'first-person singular present indicative of savoir'],
  savoir: ['Verb', 'to know (a fact)', 'to know how to'],
  faire: ['Verb', 'to do', 'to make'],
  vide: ['Noun', 'emptiness', 'void', 'gap'],
  encore: ['Adverb', 'again', 'still', 'yet'],
  même: ['Adverb', 'even'],
  parti: ['Verb', 'past participle of partir'],
  partir: ['Verb', 'to leave', 'to depart'],
  aime: ['Verb', 'first-person singular present indicative of aimer'],
  aimer: ['Verb', 'to love', 'to like'],
  reviens: ['Verb', 'first-person singular present indicative of revenir'],
  là: ['Adverb', 'there', 'here'],
};

const TABLES: Record<SourceLanguageCode, Record<string, Entry>> = { es: ES, fr: FR };

const senseOf = ([partOfSpeech, ...meanings]: Entry): WordSense => ({ partOfSpeech, meanings });

export class DemoDictionaryProvider implements DictionaryProvider {
  readonly id = 'demo';
  readonly displayName = 'Demo dictionary';
  readonly source = 'demo' as const;

  async lookup(word: string, language: SourceLanguageCode): Promise<DictionaryLookup | null> {
    await new Promise((resolve) => setTimeout(resolve, 250)); // make the loading state visible
    const entry = TABLES[language][word];
    return entry ? { senses: [senseOf(entry)], sourceUrl: null } : null;
  }
}
