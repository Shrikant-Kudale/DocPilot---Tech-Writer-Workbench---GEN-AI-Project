/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
    return null;
  }
}

export type ChatAction =
  | 'rag_answer'
  | 'rewrite'
  | 'lint_suggest'
  | 'prompt_run'
  | 'release_notes'
  | 'eval_answer';

export async function handleChatRequest(body: {
  action: ChatAction;
  question?: string;
  context?: string;
  contextChunks?: Array<{
    citationIndex: number;
    file: string;
    heading: string;
    content: string;
  }>;
  text?: string;
  tone?: string;
  goal?: string;
  issuesSummary?: string;
  systemPrompt?: string;
  template?: string;
  input?: string;
  rawCommits?: string;
}) {
  const ai = getAiClient();

  if (!ai) {
    return generateLocalFallback(body);
  }

  try {
    switch (body.action) {
      case 'rag_answer': {
        const question = body.question || '';
        const chunks = body.contextChunks || [];
        const contextText = chunks
          .map(
            (c) =>
              `[Citation ${c.citationIndex}] File: ${c.file} | Heading: ${c.heading}\n${c.content}`
          )
          .join('\n\n---\n\n');

        const prompt = `You are DocPilot, a technical documentation RAG assistant for software developers.
Answer the question accurately based ONLY on the provided documentation excerpts below.
Cite the excerpts using bracketed numbers matching the citations, like [1] or [2].
If the excerpts do not contain the answer, reply exactly: "Information not found in the documentation."

DOCUMENTATION EXCERPTS:
${contextText}

QUESTION:
${question}

ANSWER (Concise, accurate, with [N] citations):`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return {
          answer: response.text || 'No response generated.',
          model: 'gemini-3.8-flash',
        };
      }

      case 'rewrite': {
        const text = body.text || '';
        const tone = body.tone || 'Concise & Developer-focused';
        const goal = body.goal || 'Improve active voice, clarity, and step structure';

        const prompt = `You are an expert technical writer following the Google Developer Documentation Style Guide.
Rewrite the following documentation draft according to these goals:
Goal: ${goal}
Tone: ${tone}

Rules:
1. Use direct imperative active voice for procedures.
2. Replace vague words ("simply", "just", "easy") and non-inclusive terms.
3. Ensure procedural steps begin with action verbs.
4. Keep technical parameters and code references intact.

ORIGINAL DRAFT:
${text}

REWRITTEN VERSION (Clean Markdown format):`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return {
          draft: response.text || text,
          model: 'gemini-3.8-flash',
        };
      }

      case 'lint_suggest': {
        const text = body.text || '';
        const issuesSummary = body.issuesSummary || '';

        const prompt = `You are a documentation style linter AI assistant.
The following text triggered these automated style issues:
${issuesSummary}

Please provide:
1. A fully corrected version of the text that resolves all issues while preserving meaning.
2. A brief bullet list of the specific changes made.

ORIGINAL TEXT:
${text}

Output format:
### Suggested Correction
[corrected text in markdown]

### Explanation of Changes
- [change 1]
- [change 2]`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return {
          suggestion: response.text || 'Unable to generate suggestion.',
          model: 'gemini-3.8-flash',
        };
      }

      case 'prompt_run': {
        const systemPrompt = body.systemPrompt || 'You are DocPilot.';
        const template = body.template || '{{input}}';
        const input = body.input || '';
        const userPrompt = template
          .replace('{{input}}', input)
          .replace('{{question}}', input)
          .replace('{{context}}', body.context || 'DocPilot technical documentation.');

        const startTime = Date.now();
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        const latencyMs = Date.now() - startTime;

        return {
          output: response.text || '',
          latencyMs,
          model: 'gemini-3.8-flash',
        };
      }

      case 'release_notes': {
        const rawCommits = body.rawCommits || '';

        const prompt = `You are a technical documentation release manager.
Transform the following raw git commit log or developer bullet items into a polished, customer-facing changelog formatted in clean Markdown.

Sections to include:
## Highlights
## ✨ New Features
## ⚡ Improvements & Performance
## 🐛 Bug Fixes
## ⚠️ Deprecations & Breaking Changes (if any)

RAW COMMITS / NOTES:
${rawCommits}

OUTPUT (Professional Release Notes):`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return {
          notes: response.text || '',
          model: 'gemini-3.8-flash',
        };
      }

      default:
        return { error: 'Unknown action' };
    }
  } catch (err: unknown) {
    console.error('Error invoking Gemini model:', err);
    return generateLocalFallback(body);
  }
}

function generateLocalFallback(body: any) {
  switch (body.action) {
    case 'rag_answer': {
      const chunks = body.contextChunks || [];
      if (chunks.length === 0) {
        return {
          answer: 'Information not found in the documentation.',
          model: 'offline-rule-fallback',
        };
      }
      const topChunk = chunks[0];
      return {
        answer: `According to ${topChunk.heading} in ${topChunk.file} [1]:\n\n${topChunk.content.slice(0, 320)}...\n\nRefer to [1] for full configuration details.`,
        model: 'offline-rule-fallback',
      };
    }
    case 'rewrite': {
      let draft = body.text || '';
      draft = draft
        .replace(/\bwhitelist\b/gi, 'allowlist')
        .replace(/\bblacklist\b/gi, 'denylist')
        .replace(/\bsimply\s+/gi, '')
        .replace(/\bjust\s+/gi, '')
        .replace(/\bclick here\b/gi, 'view the documentation');
      return {
        draft: `### Cleaned Draft (Offline Engine)\n\n${draft}`,
        model: 'offline-rule-fallback',
      };
    }
    case 'lint_suggest': {
      return {
        suggestion: `### Suggested Correction\n${(body.text || '')
          .replace(/\bwhitelist\b/gi, 'allowlist')
          .replace(/\bblacklist\b/gi, 'denylist')
          .replace(/\bsimply\s+/gi, '')}\n\n### Explanation of Changes\n- Removed filler words ('simply', 'just')\n- Standardized inclusive terminology (allowlist/denylist)`,
        model: 'offline-rule-fallback',
      };
    }
    case 'prompt_run': {
      return {
        output: `Processed using fallback template with input: "${body.input}". (Configure GEMINI_API_KEY for live LLM output).`,
        latencyMs: 45,
        model: 'offline-rule-fallback',
      };
    }
    case 'release_notes': {
      return {
        notes: `## Release Notes\n\n### ✨ Updates\n${body.rawCommits
          ?.split('\n')
          .filter(Boolean)
          .map((c: string) => `- ${c.replace(/^[a-f0-9]+\s+/, '')}`)
          .join('\n')}`,
        model: 'offline-rule-fallback',
      };
    }
    default:
      return { answer: 'Processed', model: 'offline-rule-fallback' };
  }
}
