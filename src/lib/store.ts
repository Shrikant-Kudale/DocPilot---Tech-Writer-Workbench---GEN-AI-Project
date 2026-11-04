/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import fallbackEmbeddings from '../../data/embeddings.json';
import defaultGoldenQuestions from '../../data/golden.json';
import { DocChunk } from './chunk';
import { isRawPdfBinary } from './pdfClient';

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

// Storage keys - version bumped to v10 to immediately purge any legacy corrupted chunks
const STORAGE_KEYS = {
  CHUNKS: 'docpilot_chunks_v10',
  LEGACY_KEYS: [
    'docpilot_chunks_v1',
    'docpilot_chunks_v2',
    'docpilot_chunks_v3',
    'docpilot_chunks_v4',
    'docpilot_chunks_v5',
  ],
  GAPS: 'docpilot_gaps_v2',
  PROMPTS: 'docpilot_prompts_v2',
  GOLDEN: 'docpilot_golden_v2',
  EVALS: 'docpilot_evals_v2',
};

// Default initial prompt templates
const DEFAULT_PROMPTS: PromptVersion[] = [
  {
    id: 'prompt-plain-v1',
    name: 'Plain English & Friendly (Recommended)',
    description: 'Direct, easy-to-understand conversational explanation without technical jargon or code symbols.',
    systemPrompt:
      'You are DocPilot, a helpful documentation assistant. Answer questions clearly in natural, plain text English suitable for non-technical readers. Do not use raw markdown tags, brackets, or code symbols. Cite sources naturally.',
    template: 'Documentation Context:\n{{context}}\n\nQuestion:\n{{question}}\n\nClear Plain Text Answer:',
    createdAt: '2026-11-01T12:00:00Z',
  },
  {
    id: 'prompt-stepbystep-v2',
    name: 'Step-by-Step with Action Verbs',
    description: 'Clear numbered procedure with action verbs for each instruction.',
    systemPrompt:
      'You are DocPilot. Explain the resolution as numbered, step-by-step instructions. Begin each step with an active verb (e.g. Open, Select, Enter). Explain what to expect at each step.',
    template: 'Documentation:\n{{context}}\n\nTask:\n{{question}}\n\nStep-by-step instructions:',
    createdAt: '2026-11-02T15:30:00Z',
  },
  {
    id: 'prompt-summary-v3',
    name: 'Executive Summary',
    description: 'Brief, high-level summary highlighting key takeaways and recommendations.',
    systemPrompt:
      'You are an executive documentation advisor. Provide a concise 2-3 paragraph summary of the topic followed by key bullet takeaways.',
    template: 'Context:\n{{context}}\n\nTopic:\n{{question}}\n\nExecutive Summary:',
    createdAt: '2026-11-03T09:00:00Z',
  },
];

// Initial starter gap items
const DEFAULT_GAPS: GapReportItem[] = [
  {
    id: 'gap-seed-1',
    question: 'How do I migrate from legacy session tokens to OAuth JWTs?',
    count: 3,
    date: '2026-11-03T14:22:00Z',
    topSimilarity: 0.42,
    status: 'unresolved',
  },
  {
    id: 'gap-seed-2',
    question: 'How do I set up custom webhook retry limits?',
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

/**
 * Validates that a chunk is free from PDF binary stream code.
 */
function isValidCleanChunk(c: any): boolean {
  if (!c || typeof c !== 'object') return false;
  if (!c.content || typeof c.content !== 'string') return false;
  if (isRawPdfBinary(c.content)) return false;
  if (c.heading && isRawPdfBinary(c.heading)) return false;
  return true;
}

// Storage abstraction layer
export const docStore = {
  // --- Chunks / Document Library ---
  getChunks(): DocChunk[] {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // Purge all old legacy storage keys that could have stored corrupt PDF stream data
        for (const legacyKey of STORAGE_KEYS.LEGACY_KEYS) {
          localStorage.removeItem(legacyKey);
        }

        // 1. Try reading active v10 chunks
        const stored = localStorage.getItem(STORAGE_KEYS.CHUNKS);
        if (stored) {
          const parsed: DocChunk[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Filter out any corrupt binary chunks and ensure filenames end in .md
            const sanitized = parsed
              .filter(isValidCleanChunk)
              .map((chunk) => {
                let cleanFileName = chunk.file;
                if (
                  cleanFileName.toLowerCase().endsWith('.pdf') ||
                  cleanFileName.toLowerCase().endsWith('.docx') ||
                  cleanFileName.toLowerCase().endsWith('.txt')
                ) {
                  cleanFileName = cleanFileName.replace(/\.[^/.]+$/, '') + '.md';
                }
                return {
                  ...chunk,
                  file: cleanFileName,
                };
              });

            if (sanitized.length !== parsed.length) {
              // Persist the sanitized list
              localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(sanitized));
            }
            if (sanitized.length > 0) {
              return sanitized;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed reading chunks from storage, fallback loaded', e);
    }

    // Default: Return pre-seeded clean documentation (clean Markdown files)
    const defaults = (fallbackEmbeddings as DocChunk[])
      .filter(isValidCleanChunk)
      .map((c) => ({
        ...c,
        file: c.file.toLowerCase().endsWith('.pdf')
          ? c.file.replace(/\.[^/.]+$/, '') + '.md'
          : c.file,
      }));

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(defaults));
      }
    } catch {
      // ignore
    }
    return defaults;
  },

  setChunks(chunks: DocChunk[]): void {
    try {
      // Strict filter against any binary stream chunks
      const sanitized = chunks.filter(isValidCleanChunk);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(sanitized));
      }
      emitChange();
    } catch (e) {
      console.error('Failed saving chunks', e);
    }
  },

  addChunks(newChunks: DocChunk[]): void {
    const current = this.getChunks();
    const cleanNew = newChunks.filter(isValidCleanChunk);
    const newFiles = new Set(cleanNew.map((c) => c.file.toLowerCase()));
    // Evict any existing chunks for these uploaded files
    const retained = current.filter(
      (c) => !newFiles.has(c.file.toLowerCase()) && !cleanNew.some((nc) => nc.id === c.id)
    );
    this.setChunks([...cleanNew, ...retained]);
  },

  deleteChunk(id: string): void {
    const current = this.getChunks();
    this.setChunks(current.filter((c) => c.id !== id));
  },

  resetChunksToDefault(): void {
    const defaults = (fallbackEmbeddings as DocChunk[]).filter(isValidCleanChunk);
    this.setChunks(defaults);
  },

  // --- Gap Report ---
  getGaps(): GapReportItem[] {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEYS.GAPS);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('Failed reading gaps from storage', e);
    }
    return DEFAULT_GAPS;
  },

  setGaps(gaps: GapReportItem[]): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.GAPS, JSON.stringify(gaps));
      }
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

  // --- Prompt Studio ---
  getPrompts(): PromptVersion[] {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEYS.PROMPTS);
        if (stored) {
          return JSON.parse(stored);
        }
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(prompts));
      }
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEYS.GOLDEN);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('Failed reading golden set', e);
    }
    return defaultGoldenQuestions as GoldenQuestion[];
  },

  setGoldenQuestions(questions: GoldenQuestion[]): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.GOLDEN, JSON.stringify(questions));
      }
      emitChange();
    } catch (e) {
      console.error('Failed saving golden questions', e);
    }
  },

  getEvalRuns(): EvalRun[] {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEYS.EVALS);
        if (stored) {
          return JSON.parse(stored);
        }
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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.EVALS, JSON.stringify(updated));
      }
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
