/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import fallbackEmbeddings from '../../data/embeddings.json';
import defaultGoldenQuestions from '../../data/golden.json';
import { DocChunk } from './chunk';

export interface GapReportItem {
  id: string;
  question: string;
  count: number;
  date: string;
  topSimilarity: number;
  status: 'unresolved' | 'resolved';
}

export interface PromptVersion {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  template: string;
  createdAt: string;
}

export interface GoldenQuestion {
  id: string;
  question: string;
  expectedChunkId: string;
  expectedFile: string;
  expectedHeading: string;
  expectedKeywords: string[];
  category: string;
}

export interface EvalResultItem {
  questionId: string;
  question: string;
  expectedFile: string;
  retrievedChunkId?: string;
  retrievedFile?: string;
  retrievalHit: boolean;
  similarity: number;
  accuracyScore: number;
  generatedAnswer?: string;
  notes: string;
}

export interface EvalRun {
  id: string;
  timestamp: string;
  hitRate: number;
  avgAccuracy: number;
  totalEvaluated: number;
  results: EvalResultItem[];
}

// Storage keys
const STORAGE_KEYS = {
  CHUNKS: 'docpilot_chunks_v1',
  GAPS: 'docpilot_gaps_v1',
  PROMPTS: 'docpilot_prompts_v1',
  GOLDEN: 'docpilot_golden_v1',
  EVALS: 'docpilot_evals_v1',
};

// Default initial prompt templates
const DEFAULT_PROMPTS: PromptVersion[] = [
  {
    id: 'prompt-concise-v1',
    name: 'v1: Technical Writer Concise',
    description: 'Direct, declarative documentation style following Google Dev Docs guidelines.',
    systemPrompt: 'You are DocPilot, an expert technical writer. Answer strictly based on the provided documentation context. Keep answers clear, imperative, and concise. Never speculate. Cite source headings using [1], [2].',
    template: 'Context:\n{{context}}\n\nQuestion:\n{{question}}\n\nAnswer:',
    createdAt: '2026-11-01T12:00:00Z',
  },
  {
    id: 'prompt-stepbystep-v2',
    name: 'v2: Step-by-Step with Prerequisites',
    description: 'Procedural format with prerequisites, imperative numbered steps, and expected outcome.',
    systemPrompt: 'You are DocPilot technical author. Structure your response into: 1. Prerequisites 2. Step-by-step imperative instructions 3. Verification. If the context does not contain the answer, say "Information not found in documentation."',
    template: 'Documentation:\n{{context}}\n\nTask/Question:\n{{question}}\n\nStep-by-step resolution:',
    createdAt: '2026-11-02T15:30:00Z',
  },
  {
    id: 'prompt-apiref-v3',
    name: 'v3: Minimal API Reference',
    description: 'Dense, code-first answer format tailored for software engineers reading quick references.',
    systemPrompt: 'You are an API reference generator. Give a 1-sentence summary, then copy-pasteable code examples, curl snippets, and parameter tables. Rely purely on documentation context.',
    template: 'Context:\n{{context}}\n\nQuery:\n{{question}}\n\nAPI Reference Summary:',
    createdAt: '2026-11-03T09:00:00Z',
  },
];

// Initial starter gap items
const DEFAULT_GAPS: GapReportItem[] = [
  {
    id: 'gap-seed-1',
    question: 'How do I migrate from v1 legacy session tokens to v2 OAuth JWTs?',
    count: 4,
    date: '2026-11-03T14:22:00Z',
    topSimilarity: 0.42,
    status: 'unresolved',
  },
  {
    id: 'gap-seed-2',
    question: 'Does DocPilot support GraphQL subscription endpoints on edge workers?',
    count: 2,
    date: '2026-11-02T18:10:00Z',
    topSimilarity: 0.38,
    status: 'unresolved',
  },
];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

// Storage abstraction layer
export const docStore = {
  // --- Chunks / Knowledge Base ---
  getChunks(): DocChunk[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHUNKS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading chunks from storage, fallback loaded', e);
    }
    return fallbackEmbeddings as DocChunk[];
  },

  setChunks(chunks: DocChunk[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(chunks));
      emitChange();
    } catch (e) {
      console.error('Failed saving chunks', e);
    }
  },

  addChunks(newChunks: DocChunk[]): void {
    const current = this.getChunks();
    const updated = [...newChunks, ...current.filter((c) => !newChunks.some((nc) => nc.id === c.id))];
    this.setChunks(updated);
  },

  deleteChunk(id: string): void {
    const current = this.getChunks();
    this.setChunks(current.filter((c) => c.id !== id));
  },

  resetChunksToDefault(): void {
    this.setChunks(fallbackEmbeddings as DocChunk[]);
  },

  // --- Gap Report ---
  getGaps(): GapReportItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAPS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading gaps from storage', e);
    }
    return DEFAULT_GAPS;
  },

  setGaps(gaps: GapReportItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GAPS, JSON.stringify(gaps));
      emitChange();
    } catch (e) {
      console.error('Failed saving gaps', e);
    }
  },

  logGap(question: string, topSimilarity: number): void {
    const current = this.getGaps();
    const trimmed = question.trim();
    if (!trimmed) return;

    const existingIndex = current.findIndex(
      (g) => g.question.toLowerCase() === trimmed.toLowerCase() && g.status === 'unresolved'
    );

    if (existingIndex >= 0) {
      current[existingIndex].count += 1;
      current[existingIndex].date = new Date().toISOString();
      current[existingIndex].topSimilarity = topSimilarity;
      this.setGaps([...current]);
    } else {
      const newGap: GapReportItem = {
        id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question: trimmed,
        count: 1,
        date: new Date().toISOString(),
        topSimilarity: topSimilarity,
        status: 'unresolved',
      };
      this.setGaps([newGap, ...current]);
    }
  },

  markGapResolved(id: string): void {
    const current = this.getGaps();
    const updated = current.map((g) => (g.id === id ? { ...g, status: 'resolved' as const } : g));
    this.setGaps(updated);
  },

  deleteGap(id: string): void {
    const current = this.getGaps();
    this.setGaps(current.filter((g) => g.id !== id));
  },

  // --- Prompt Lab ---
  getPrompts(): PromptVersion[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROMPTS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading prompts', e);
    }
    return DEFAULT_PROMPTS;
  },

  savePrompt(prompt: PromptVersion): void {
    const current = this.getPrompts();
    const existingIdx = current.findIndex((p) => p.id === prompt.id);
    if (existingIdx >= 0) {
      current[existingIdx] = prompt;
      this.setPrompts([...current]);
    } else {
      this.setPrompts([prompt, ...current]);
    }
  },

  setPrompts(prompts: PromptVersion[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(prompts));
      emitChange();
    } catch (e) {
      console.error('Failed saving prompts', e);
    }
  },

  deletePrompt(id: string): void {
    const current = this.getPrompts();
    this.setPrompts(current.filter((p) => p.id !== id));
  },

  // --- Golden Dataset & Evaluation ---
  getGoldenQuestions(): GoldenQuestion[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GOLDEN);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading golden set', e);
    }
    return defaultGoldenQuestions as GoldenQuestion[];
  },

  setGoldenQuestions(questions: GoldenQuestion[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GOLDEN, JSON.stringify(questions));
      emitChange();
    } catch (e) {
      console.error('Failed saving golden questions', e);
    }
  },

  getEvalRuns(): EvalRun[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVALS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading eval runs', e);
    }
    return [];
  },

  saveEvalRun(run: EvalRun): void {
    const current = this.getEvalRuns();
    const updated = [run, ...current].slice(0, 20);
    try {
      localStorage.setItem(STORAGE_KEYS.EVALS, JSON.stringify(updated));
      emitChange();
    } catch (e) {
      console.error('Failed saving eval run', e);
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * React hook for live synchronized store state
 */
export function useDocStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return docStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return docStore;
}
