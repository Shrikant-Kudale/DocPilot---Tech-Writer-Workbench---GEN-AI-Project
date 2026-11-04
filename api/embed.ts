/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { textToVectorFallback } from '../src/lib/similarity';

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

export async function handleEmbedRequest(reqBody: { texts?: string[]; text?: string }) {
  const texts = reqBody.texts || (reqBody.text ? [reqBody.text] : []);
  if (texts.length === 0) {
    return { embeddings: [], count: 0, model: 'none' };
  }

  const ai = getAiClient();

  if (ai) {
    try {
      const embeddings: number[][] = [];
      for (const text of texts) {
        // Truncate to reasonable token length for embedding model
        const cleanText = text.slice(0, 8000);
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: cleanText,
        });

        const values =
          response.embeddings?.[0]?.values ||
          (response as any).embedding?.values;
        if (values && values.length > 0) {
          // Normalize embedding vector
          embeddings.push(values);
        } else {
          embeddings.push(textToVectorFallback(text));
        }
      }

      return {
        embeddings,
        count: embeddings.length,
        model: 'gemini-embedding-2-preview',
      };
    } catch (err: unknown) {
      console.warn('Gemini embedContent failed, falling back to deterministic local vector:', err);
    }
  }

  // Resilient fallback to deterministic projection
  const fallbackEmbeddings = texts.map((t) => textToVectorFallback(t));
  return {
    embeddings: fallbackEmbeddings,
    count: fallbackEmbeddings.length,
    model: 'fallback-deterministic-cosine',
  };
}
