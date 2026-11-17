export const TRIGRAM_THRESHOLD = 0.3;
export const COSINE_THRESHOLD = 0.75;
export const COSINE_DISTANCE_WEIGHT = 1;

export interface SuggestionSignals {
  // `word_similarity` against the query (0..1).
  trigram: number;
  // pgvector cosine distance (0..2); absent without embeddings.
  distance?: number;
}

function cosine(distance: number | undefined): number {
  return distance === undefined ? 0 : 1 - distance * COSINE_DISTANCE_WEIGHT;
}

// Spec 116 FR 29: score = max(trigram similarity, 1 - cosine distance * weight).
export function passesThreshold(signals: SuggestionSignals): boolean {
  return signals.trigram >= TRIGRAM_THRESHOLD || cosine(signals.distance) >= COSINE_THRESHOLD;
}
export function suggestionScore(signals: SuggestionSignals): number {
  return Math.max(signals.trigram, cosine(signals.distance));
}
