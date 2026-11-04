/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocChunk } from './chunk';

/**
 * Computes cosine similarity between two numerical vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic text-to-vector projection fallback.
 * Generates a normalized 32-dimensional vector based on token frequencies and n-grams.
 * Used when offline or during zero-latency client searches.
 */
export function textToVectorFallback(text: string, dimensions = 32): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dimensions;
    vec[bucket] += 1.0;

    // Bigram weight
    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      let biHash = hash ^ (nextWord.charCodeAt(0) * 31);
      const biBucket = Math.abs(biHash) % dimensions;
      vec[biBucket] += 0.5;
    }
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = +(vec[i] / norm).toFixed(4);
    }
  }

  return vec;
}

export interface ScoredChunk extends DocChunk {
  similarity: number;
  citationIndex?: number;
}

/**
 * Ranks documentation chunks against a query embedding.
 * Returns chunks ordered by similarity descending.
 */
export function rankChunks(
  queryEmbedding: number[],
  chunks: DocChunk[],
  threshold = 0.55
): {
  ranked: ScoredChunk[];
  topSimilarity: number;
  hasMatch: boolean;
} {
  if (!chunks || chunks.length === 0) {
    return { ranked: [], topSimilarity: 0, hasMatch: false };
  }

  const scored: ScoredChunk[] = chunks.map((chunk) => {
    let sim = 0;
    if (chunk.embedding && chunk.embedding.length > 0 && queryEmbedding.length > 0) {
      sim = cosineSimilarity(queryEmbedding, chunk.embedding);
    }
    return {
      ...chunk,
      similarity: Math.max(0, +sim.toFixed(4)),
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  const topSimilarity = scored.length > 0 ? scored[0].similarity : 0;
  const hasMatch = topSimilarity >= threshold;

  // Add citation indices to top matches
  scored.forEach((chunk, idx) => {
    chunk.citationIndex = idx + 1;
  });

  return {
    ranked: scored,
    topSimilarity,
    hasMatch,
  };
}
