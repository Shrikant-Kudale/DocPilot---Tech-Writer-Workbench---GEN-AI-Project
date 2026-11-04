/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocChunk } from './chunk';

/**
 * Computes cosine similarity between two numerical vectors.
 * Handles dimension mismatches safely by aligning lengths and normalizing.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA <= 0 || normB <= 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, sim));
}

/**
 * Keyword relevance scoring (BM25 / TF-IDF heuristic)
 * Matches search query terms against section headings and content.
 */
export function computeKeywordRelevance(query: string, chunk: DocChunk): number {
  if (!query || !chunk) return 0;

  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'about', 'how', 'what', 'can', 'i', 'you', 'it',
    'do', 'does', 'did', 'and', 'or', 'if', 'this', 'that', 'should', 'would', 'could'
  ]);

  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  if (queryTokens.length === 0) return 0.2;

  const headingLower = (chunk.heading || '').toLowerCase();
  const fileLower = (chunk.file || '').toLowerCase();
  const contentLower = (chunk.content || '').toLowerCase();

  let matches = 0;
  let headingBonus = 0;
  let phraseBonus = 0;

  // Exact phrase match check
  const cleanQuery = query.toLowerCase().trim();
  if (cleanQuery.length > 4 && (contentLower.includes(cleanQuery) || headingLower.includes(cleanQuery))) {
    phraseBonus = 0.35;
  }

  for (const token of queryTokens) {
    let tokenMatched = false;

    // Heading match gets high priority
    if (headingLower.includes(token) || fileLower.includes(token)) {
      matches += 1.5;
      headingBonus += 0.15;
      tokenMatched = true;
    }

    // Content match
    if (contentLower.includes(token)) {
      if (!tokenMatched) matches += 1.0;
    }
  }

  const tokenRatio = Math.min(1.0, matches / queryTokens.length);
  const score = tokenRatio * 0.7 + headingBonus + phraseBonus;

  return Math.max(0, Math.min(1.0, +score.toFixed(4)));
}

/**
 * Deterministic text-to-vector projection.
 * Generates a normalized 64-dimensional vector based on token frequencies and n-grams.
 */
export function textToVectorFallback(text: string, dimensions = 64): number[] {
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

    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      let biHash = hash ^ (nextWord.charCodeAt(0) * 31);
      const biBucket = Math.abs(biHash) % dimensions;
      vec[biBucket] += 0.5;
    }
  }

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
  semanticScore?: number;
  keywordScore?: number;
}

/**
 * Hybrid search ranking: blends dense semantic cosine similarity with BM25 keyword matching.
 * Always ranks and returns all relevant candidate chunks so the user can review them.
 */
export function rankChunks(
  queryEmbedding: number[],
  chunks: DocChunk[],
  rawQuery = '',
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
    // 1. Vector cosine similarity
    let vectorSim = 0;
    if (chunk.embedding && chunk.embedding.length > 0 && queryEmbedding && queryEmbedding.length > 0) {
      vectorSim = cosineSimilarity(queryEmbedding, chunk.embedding);
    }

    // 2. Keyword relevance
    const kwSim = rawQuery ? computeKeywordRelevance(rawQuery, chunk) : 0;

    // 3. Hybrid blend
    // If vector similarity is strong, give it weight. If keyword match is strong, ensure it's not buried.
    let finalSim = 0;
    if (vectorSim > 0 && kwSim > 0) {
      finalSim = Math.max(vectorSim, kwSim, vectorSim * 0.5 + kwSim * 0.5);
    } else if (vectorSim > 0) {
      finalSim = vectorSim;
    } else if (kwSim > 0) {
      finalSim = kwSim;
    } else {
      finalSim = 0.1;
    }

    return {
      ...chunk,
      similarity: Math.max(0, +finalSim.toFixed(4)),
      semanticScore: +vectorSim.toFixed(4),
      keywordScore: +kwSim.toFixed(4),
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  const topSimilarity = scored.length > 0 ? scored[0].similarity : 0;
  const hasMatch = topSimilarity >= threshold;

  scored.forEach((chunk, idx) => {
    chunk.citationIndex = idx + 1;
  });

  return {
    ranked: scored,
    topSimilarity,
    hasMatch,
  };
}
