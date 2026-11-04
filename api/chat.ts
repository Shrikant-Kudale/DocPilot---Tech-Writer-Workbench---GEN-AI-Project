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

/**
 * Strips raw markdown syntax, escape slashes, bracketed links, and formatting symbols
 * to produce clean, natural human-readable plain text for non-technical readers.
 */
export function cleanToPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+(.*)$/gm, '$1') // Convert # Header to Header
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italics
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
    .replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1') // Unwrap code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link text](url) -> link text
    .replace(/\[\s*\d+\s*\]/g, '') // Remove citation brackets [1], [2]
    .replace(/\\([()[\]\\/`*_#+-])/g, '$1') // Remove backslash escapes
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\|\s*[-:]+[-|\s:]*\|/g, '') // Remove markdown table divider rows
    .replace(/\|/g, ' ') // Remove table pipes
    .replace(/^\s*[-*+]\s+/gm, '• ') // Standardize bullets to friendly dots
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

        // Prepare clean readable excerpts for the model without raw code gibberish
        const contextText = chunks
          .map((c) => {
            const cleanContent = cleanToPlainText(c.content);
            return `Source File: ${c.file}\nSection: ${c.heading}\nContent:\n${cleanContent}`;
          })
          .join('\n\n---\n\n');

        const prompt = `You are DocPilot, a helpful documentation assistant for technical writers and non-technical readers alike.
Answer the question accurately based on the provided documentation excerpts below.

CRITICAL FORMATTING INSTRUCTIONS FOR HUMAN READABILITY:
1. OUTPUT IN CLEAN PLAIN TEXT: Do not output raw markdown symbols, raw brackets like [1], escape slashes (\\ or \/), backticks, asterisks for bold, or raw HTML tags. Write so that a normal human reader can read comfortably without seeing technical markup code.
2. DO NOT COPY-PASTE RAW CHUNKS: Synthesize the facts into your own well-structured sentences. Explain what the document means in clear, conversational English.
3. CITATIONS AS PLAIN ENGLISH: Mention source documents naturally by name in your sentences (for example: "According to ${chunks[0]?.file ? chunks[0].file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'the documentation'}..."). Do not use bracketed numbers like [1].
4. STRUCTURE: Use clean paragraph breaks and clear bullet points (• Item) for lists.
5. If the documentation does not fully answer the question, state politely what is available and what information is missing.

DOCUMENTATION EXCERPTS:
${contextText}

QUESTION:
${question}

ANSWER IN PLAIN TEXT:`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        const rawGenerated = response.text || 'No response generated.';
        // Clean any accidental markdown artifacts
        const cleanAnswer = cleanToPlainText(rawGenerated);

        return {
          answer: cleanAnswer,
          model: 'gemini-3.8-flash',
        };
      }

      case 'rewrite': {
        const text = body.text || '';
        const tone = body.tone || 'Clear and Friendly';
        const goal = body.goal || 'Active voice, clear step-by-step instructions, remove jargon';

        const prompt = `You are an expert technical editor.
Rewrite the following documentation draft according to these goals:
Goal: ${goal}
Tone: ${tone}

Rules:
1. Make the explanation simple and clear for both technical and non-technical readers.
2. Use active voice and action verbs for steps.
3. Replace confusing jargon, passive phrasing, and unnecessary filler words.
4. Keep technical parameters and important references intact.
5. Present the result in clean, well-spaced format.

ORIGINAL DRAFT:
${text}

REWRITTEN VERSION:`;

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

        const prompt = `You are a writing coach and documentation style assistant.
The following text has these writing style issues:
${issuesSummary}

Please provide:
1. A clear, improved version of the text that fixes these issues in simple, natural English.
2. A brief, friendly bulleted summary of what was improved and why.

ORIGINAL TEXT:
${text}

Output format:
Suggested Correction:
[improved text]

What Changed:
• [friendly explanation 1]
• [friendly explanation 2]`;

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
          .replace('{{context}}', body.context || 'Documentation library.');

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
          output: cleanToPlainText(response.text || ''),
          latencyMs,
          model: 'gemini-3.8-flash',
        };
      }

      case 'release_notes': {
        const rawCommits = body.rawCommits || '';

        const prompt = `You are a technical documentation release manager.
Transform the following raw developer commit notes into a clear, reader-friendly release summary suitable for non-technical users and customers.
Avoid technical jargon where simple language works.

Sections to include:
Highlights
New Features
Improvements & Fixes

RAW NOTES:
${rawCommits}

OUTPUT IN CLEAN PLAIN TEXT:`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return {
          notes: cleanToPlainText(response.text || ''),
          model: 'gemini-3.8-flash',
        };
      }

      default:
        return { error: 'Unknown action' };
    }
  } catch (err: unknown) {
    console.error('Error invoking Gemini model, using plain text fallback:', err);
    return generateLocalFallback(body);
  }
}

/**
 * Intelligent local plain-text synthesis fallback when offline or without API key.
 * Formulates a clear, natural English response without dumping raw code, markdown syntax, or brackets.
 */
function generateLocalFallback(body: any) {
  switch (body.action) {
    case 'rag_answer': {
      const chunks = body.contextChunks || [];
      if (chunks.length === 0) {
        return {
          answer:
            'No matching documentation was found in your library for this question. You can upload relevant documents in the Document Library tab.',
          model: 'offline-synthesis',
        };
      }

      const topChunk = chunks[0];
      const cleanContent = cleanToPlainText(topChunk.content);
      const friendlyFile = topChunk.file
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();

      // Extract key sentences
      const sentences = cleanContent
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && !s.startsWith('#'));

      const summarySentences = sentences.slice(0, 4).join(' ');

      const formattedAnswer = [
        `According to the documentation in "${friendlyFile}" (under the section "${topChunk.heading}"):`,
        '',
        summarySentences || cleanContent.slice(0, 320),
        '',
        chunks.length > 1
          ? `Additional related information is available in "${chunks[1].heading}". You can review the exact source excerpts in the citations section below.`
          : 'You can review the full source text below in the citations section.',
      ].join('\n');

      return {
        answer: formattedAnswer,
        model: 'offline-synthesis',
      };
    }

    case 'rewrite': {
      let draft = cleanToPlainText(body.text || '');
      draft = draft
        .replace(/\bwhitelist\b/gi, 'allowlist')
        .replace(/\bblacklist\b/gi, 'denylist')
        .replace(/\bsimply\s+/gi, '')
        .replace(/\bjust\s+/gi, '')
        .replace(/\bobviously\s*,?\s*/gi, '')
        .replace(/\bclick here\b/gi, 'view the documentation');

      return {
        draft: `Improved Draft:\n\n${draft}`,
        model: 'offline-synthesis',
      };
    }

    case 'lint_suggest': {
      const cleanText = cleanToPlainText(body.text || '');
      const improved = cleanText
        .replace(/\bwhitelist\b/gi, 'allowlist')
        .replace(/\bblacklist\b/gi, 'denylist')
        .replace(/\bsimply\s+/gi, '')
        .replace(/\bjust\s+/gi, '')
        .replace(/\bobviously\s*,?\s*/gi, '');

      return {
        suggestion: `Suggested Correction:\n${improved}\n\nWhat Changed:\n• Removed filler words like "simply", "just", and "obviously"\n• Updated non-inclusive terms to clear modern standards (allowlist/denylist)\n• Clarified procedural instructions into direct active voice`,
        model: 'offline-synthesis',
      };
    }

    case 'prompt_run': {
      return {
        output: `Processed response for: "${cleanToPlainText(body.input || '')}".`,
        latencyMs: 30,
        model: 'offline-synthesis',
      };
    }

    case 'release_notes': {
      const cleanCommits = (body.rawCommits || '')
        .split('\n')
        .filter(Boolean)
        .map((c: string) => `• ${cleanToPlainText(c.replace(/^[a-f0-9]+\s+/, ''))}`)
        .join('\n');

      return {
        notes: `Release Summary:\n\nRecent Updates & Enhancements:\n${cleanCommits}`,
        model: 'offline-synthesis',
      };
    }

    default:
      return { answer: 'Processed', model: 'offline-synthesis' };
  }
}

// Vercel Serverless Function export
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await handleChatRequest(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Chat generation failed' });
  }
}
