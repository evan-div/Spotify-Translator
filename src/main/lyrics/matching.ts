import type { TrackQuery } from '@shared/types/domain';
import { artistMatchScore, titleSimilarity } from '@shared/utils/text';

export interface MatchCandidate {
  title: string;
  artist: string;
  durationMs: number | null;
  hasSyncedLyrics?: boolean;
  instrumental?: boolean;
}

/** Duration differences up to this are considered the same recording for sync purposes. */
export const SYNC_TRUST_TOLERANCE_MS = 5000;
const FULL_DURATION_SCORE_MS = 3000;
const ZERO_DURATION_SCORE_MS = 15_000;
export const MIN_ACCEPTABLE_SCORE = 0.7;

export function durationScore(wantedMs: number, candidateMs: number | null): number {
  if (candidateMs === null || wantedMs <= 0) return 0.5;
  const diff = Math.abs(wantedMs - candidateMs);
  if (diff <= FULL_DURATION_SCORE_MS) return 1;
  if (diff >= ZERO_DURATION_SCORE_MS) return 0;
  return 1 - (diff - FULL_DURATION_SCORE_MS) / (ZERO_DURATION_SCORE_MS - FULL_DURATION_SCORE_MS);
}

export interface ScoredCandidate<T extends MatchCandidate> {
  candidate: T;
  score: number;
  titleScore: number;
  artistScore: number;
}

/** Overall 0..1 confidence that `candidate` is the same song as `query`. */
export function scoreCandidate<T extends MatchCandidate>(query: TrackQuery, candidate: T): ScoredCandidate<T> {
  const titleScore = titleSimilarity(query.title, candidate.title);
  const artistScore = artistMatchScore(query.artists, candidate.artist);
  const duration = durationScore(query.durationMs, candidate.durationMs);
  const syncBonus = candidate.hasSyncedLyrics ? 0.03 : 0;
  const score = titleScore * 0.5 + artistScore * 0.3 + duration * 0.2 + syncBonus;
  return { candidate, score, titleScore, artistScore };
}

/** Best acceptable candidate, or null. A title AND artist must plausibly match. */
export function pickBestCandidate<T extends MatchCandidate>(query: TrackQuery, candidates: readonly T[]): T | null {
  const scored = candidates
    .filter((c) => !c.instrumental)
    .map((c) => scoreCandidate(query, c))
    .filter((s) => s.titleScore >= 0.7 && s.artistScore > 0 && s.score >= MIN_ACCEPTABLE_SCORE)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.candidate ?? null;
}

/** Whether a candidate's timestamps can be trusted against the Spotify recording. */
export function canTrustSync(query: TrackQuery, candidateDurationMs: number | null): boolean {
  if (candidateDurationMs === null || query.durationMs <= 0) return true;
  return Math.abs(query.durationMs - candidateDurationMs) <= SYNC_TRUST_TOLERANCE_MS;
}
