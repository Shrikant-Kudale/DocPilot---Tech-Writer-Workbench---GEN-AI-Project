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
        const cleanText = text.slice(0, 8000);
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: cleanText,
        });

        const values =
          response.embeddings?.[0]?.values ||
          (response as any).embedding?.values;
        if (values && values.length > 0) {
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

  const fallbackEmbeddings = texts.map((t) => textToVectorFallback(t));
  return {
    embeddings: fallbackEmbeddings,
    count: fallbackEmbeddings.length,
    model: 'fallback-deterministic-cosine',
  };
}

// Vercel Serverless Function export
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await handleEmbedRequest(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Embedding generation failed' });
  }
}
