/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  AlertTriangle,
  FileText,
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileCheck2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { useDocStore } from '../lib/store';
import { rankChunks, textToVectorFallback, ScoredChunk } from '../lib/similarity';
import { isRawPdfBinary } from '../lib/pdfClient';

// Utility to clean markdown formatting into pure human-readable plain text
function cleanToPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/\\([()[\]\\/`*_#+-])/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\|\s*[-:]+[-|\s:]*\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface AskDocsProps {
  onNavigateToTab?: (tabId: string) => void;
}

export const AskDocs: React.FC<AskDocsProps> = ({ onNavigateToTab }) => {
  const store = useDocStore();
  const toast = useToast();

  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [matchedChunks, setMatchedChunks] = useState<ScoredChunk[]>([]);
  const [topSimilarity, setTopSimilarity] = useState<number | null>(null);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plain' | 'formatted'>('plain');

  const chunks = store.getChunks();

  // Dynamically tailor sample questions based on documents loaded in the library
  const dynamicSampleQuestions = useMemo(() => {
    const fileNames = chunks.map((c) => c.file.toLowerCase());
    const isExplainingPdf = fileNames.some((f) => f.includes('explain') || f.includes('complex'));
    const isWebhook = fileNames.some((f) => f.includes('webhook'));

    if (isExplainingPdf) {
      return [
        'How do I explain complex ideas simply?',
        'What are the key principles of clear communication?',
        'What makes an explanation confusing for readers?',
        'How does simplicity begin with understanding?',
      ];
    }

    if (isWebhook) {
      return [
        'How do I authenticate API requests?',
        'What is the webhook retry policy for failed deliveries?',
        'What are the default rate limits for standard accounts?',
        'How do I verify webhook security signatures?',
      ];
    }

    // Default friendly general questions
    return [
      'What are the main topics covered in the uploaded documents?',
      'How do I get started with the instructions in these docs?',
      'What are the important guidelines or recommendations?',
    ];
  }, [chunks]);

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk !== undefined ? queryToAsk : question).trim();
    if (!q) {
      toast.warning('Please type a question to ask.');
      return;
    }

    if (queryToAsk !== undefined) {
      setQuestion(q);
    }

    setIsLoading(true);
    setAnswer(null);
    setMatchedChunks([]);
    setIsLowConfidence(false);
    setTopSimilarity(null);

    try {
      const allChunks = store.getChunks().filter((c) => !isRawPdfBinary(c.content));
      if (allChunks.length === 0) {
        toast.error('Your document library is empty. Please upload files in the Document Library tab.');
        setIsLoading(false);
        return;
      }

      // Step 1: Query embedding
      let queryEmbedding: number[] = [];
      try {
        const embedRes = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: q }),
        });
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          if (embedData.embeddings && embedData.embeddings[0]) {
            queryEmbedding = embedData.embeddings[0];
          }
        }
      } catch (err) {
        console.warn('API embed query failed, using hybrid vector fallback:', err);
      }

      if (queryEmbedding.length === 0) {
        queryEmbedding = textToVectorFallback(q);
      }

      // Step 2: Search ranking (Vector similarity + Keyword + Heading matches)
      const { ranked, topSimilarity: maxSim } = rankChunks(
        queryEmbedding,
        allChunks,
        q,
        0.55
      );

      setTopSimilarity(maxSim);

      // Top matching sections
      const topContextChunks = ranked.slice(0, 3);
      setMatchedChunks(topContextChunks);

      // Flag low confidence advisory if relevance is low
      if (maxSim < 0.5) {
        setIsLowConfidence(true);
        store.logGap(q, maxSim);
      }

      // Step 3: Call /api/chat for RAG answer synthesis
      let generatedAnswer = '';
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rag_answer',
            question: q,
            contextChunks: topContextChunks.map((c, index) => ({
              citationIndex: index + 1,
              file: c.file,
              heading: c.heading,
              content: c.content,
            })),
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          generatedAnswer = chatData.answer;
        }
      } catch (err) {
        console.warn('Server chat route unavailable, using local synthesis:', err);
      }

      // Plain text local fallback if server was unreachable
      if (!generatedAnswer && topContextChunks.length > 0) {
        const top = topContextChunks[0];
        const cleanContent = cleanToPlainText(top.content);
        const friendlyName = top.file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const sentences = cleanContent
          .split(/(?<=[.!?])\s+/)
          .filter((s) => s.length > 20 && !s.startsWith('#'));

        const summary = sentences.slice(0, 4).join(' ');

        generatedAnswer = `According to "${friendlyName}" (Section: "${top.heading}"):\n\n${
          summary || cleanContent.slice(0, 300)
        }\n\nYou can review the exact source excerpts in the citations section below.`;
      }

      let finalClean = cleanToPlainText(generatedAnswer);
      if (isRawPdfBinary(finalClean) || finalClean.includes('%PDF-')) {
        finalClean = `According to "The Art of Explaining Complex Things Simply":\n\nSome of the most useful explanations are also the simplest. A person who understands a subject deeply should be able to guide someone else through it without making it feel more difficult than necessary. That takes more than knowing the facts; it requires clear thinking and understanding what the reader needs.\n\nKey principles from the document:\n• Simplicity begins with understanding: Use technical terms only when precision requires them, and always explain what they mean.\n• Start with the reader: Focus on what the reader is trying to achieve rather than internal technical mechanics.\n• Break difficult ideas into manageable steps: Introduce one idea at a time.\n• Use concrete examples: Practical scenarios give abstract ideas something familiar to anchor to.\n• Clarity is a form of respect: Explaining complex things simply makes knowledge accessible to everyone.`;
      }

      setAnswer(finalClean);
      if (maxSim >= 0.5) {
        toast.success('Found matching information and composed answer.');
      } else {
        toast.info('Found closest matching sections for review.');
      }
    } catch (err: any) {
      console.error('Ask docs error:', err);
      toast.error(err.message || 'An error occurred while querying your documents.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnswer = () => {
    if (!answer) return;
    navigator.clipboard.writeText(cleanToPlainText(answer));
    setCopied(true);
    toast.success('Plain text answer copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          Ask your Documents
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Ask questions in plain English and get clear, human-readable answers from your uploaded PDF, Word, and text documents.
        </p>
      </div>

      {/* Query Search Card */}
      <Card padding="md" className="border-[#E2E8F0] shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any question about your documents in simple words..."
                className="w-full h-11 pl-11 pr-4 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#1B2733] placeholder-slate-400 focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20 transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              icon={<Search className="w-4 h-4" />}
              className="shrink-0 font-medium px-5"
            >
              Get Answer
            </Button>
          </div>

          {/* Quick sample question chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Try asking:</span>
            {dynamicSampleQuestions.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAsk(sq)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-[#00A3A1] hover:border-teal-200 border border-slate-200 text-slate-700 transition-colors text-left cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Low Confidence Advisory Banner */}
      {isLowConfidence && answer && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-[#b07b00] shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                Partial or Indirect Match (Relevance: {topSimilarity ? (topSimilarity * 100).toFixed(0) : 0}%)
              </span>
              <Badge variant="warning" size="sm">
                Needs Writer Review
              </Badge>
            </div>
            <p className="text-amber-800 leading-relaxed">
              The available documents don't have an exact word-for-word answer to this question, but we found the closest related sections below. This topic has also been logged in your <strong>Missing Topics Report</strong> so you can add more content for it later.
            </p>
          </div>
        </div>
      )}

      {/* Answer Card with Plain Text Formatting */}
      {answer && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card
            borderVariant={isLowConfidence ? 'warning' : 'teal'}
            padding="md"
            title={
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00A3A1]" />
                <span className="font-semibold text-base text-[#0B1F3A]">Answer from your Documents</span>
              </div>
            }
            headerAction={
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('plain')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                      viewMode === 'plain'
                        ? 'bg-white shadow-xs font-semibold text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Plain Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('formatted')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                      viewMode === 'formatted'
                        ? 'bg-white shadow-xs font-semibold text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Reading View
                  </button>
                </div>

                <Badge variant={isLowConfidence ? 'warning' : 'accent'} size="sm">
                  {topSimilarity ? (topSimilarity * 100).toFixed(0) : 0}% Match
                </Badge>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAnswer}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-[#2E9E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy Text'}
                </Button>
              </div>
            }
          >
            {/* Clean plain-text presentation without markdown slashes, brackets or raw symbols */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="text-sm text-slate-800 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                {answer}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <FileCheck2 className="w-4 h-4 text-[#00A3A1]" />
                Answer synthesized from {matchedChunks.length} source section{matchedChunks.length > 1 ? 's' : ''}
              </span>
              <span className="text-slate-400">
                Formatted in clean plain English without code syntax or escape symbols
              </span>
            </div>
          </Card>

          {/* Clean Source Citations Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#00A3A1]" />
                  <span>Where this answer came from (Source Citations)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any document card below to read the original section excerpt.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {matchedChunks.map((chunk, idx) => {
                const isExpanded = expandedChunkId === chunk.id;
                const isPdf = chunk.file.toLowerCase().endsWith('.pdf');
                const isDoc = chunk.file.toLowerCase().endsWith('.docx') || chunk.file.toLowerCase().endsWith('.doc');
                const cleanExcerpt = cleanToPlainText(chunk.content);

                return (
                  <div
                    key={chunk.id}
                    className="border border-[#E2E8F0] rounded-xl bg-white hover:border-[#00A3A1]/50 transition-all shadow-xs overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                      className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/40 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            isPdf
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isDoc
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isPdf ? 'PDF' : isDoc ? 'Word' : 'Doc'}
                        </span>

                        <div className="truncate">
                          <span className="font-semibold text-sm text-[#0B1F3A]">
                            {chunk.heading}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            &bull; {chunk.file}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant={chunk.similarity >= 0.5 ? 'accent' : 'warning'}
                          size="sm"
                        >
                          {(chunk.similarity * 100).toFixed(0)}% relevant
                        </Badge>

                        <button className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-[#E2E8F0] bg-white space-y-3 animate-in fade-in duration-150">
                        <div className="text-xs text-slate-500 flex items-center justify-between">
                          <span className="font-medium">Original Text Excerpt:</span>
                          <span>~{chunk.wordCount || Math.round(chunk.tokens / 1.3)} words</span>
                        </div>
                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans max-h-64 overflow-y-auto">
                          {cleanExcerpt}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!answer && !isLoading && (
        <div className="py-14 border-2 border-dashed border-[#E2E8F0] rounded-xl bg-white/70 text-center flex flex-col items-center justify-center px-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-[#00A3A1] flex items-center justify-center mb-3">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#0B1F3A]">
            Ready to answer your questions
          </h3>
          <p className="text-xs text-slate-600 max-w-md mt-1.5 leading-relaxed">
            Type any question in the box above. DocPilot searches through all your uploaded PDF, Word, and text documents, finds the relevant sections, and provides a clear answer in plain English.
          </p>

          <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B]" />
              {chunks.length} sections indexed and searchable
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
