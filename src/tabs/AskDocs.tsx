/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  AlertTriangle,
  FileText,
  ExternalLink,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { useDocStore } from '../lib/store';
import { rankChunks, textToVectorFallback, ScoredChunk } from '../lib/similarity';

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

  const sampleQuestions = [
    'How do I authenticate API requests?',
    'What is the webhook retry policy for failed deliveries?',
    'What are the default rate limits for Tier 1 accounts?',
    'How do I verify webhook HMAC signatures in Python?',
    'What SDK client libraries are available?',
  ];

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk !== undefined ? queryToAsk : question).trim();
    if (!q) {
      toast.warning('Please enter a documentation question.');
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
      const allChunks = store.getChunks();
      if (allChunks.length === 0) {
        toast.error('Knowledge Base is empty. Upload files in the Knowledge Base tab.');
        setIsLoading(false);
        return;
      }

      // Step 1: Obtain query embedding
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
        console.warn('API embed query failed, using hybrid text projection:', err);
      }

      if (queryEmbedding.length === 0) {
        queryEmbedding = textToVectorFallback(q);
      }

      // Step 2: Hybrid search ranking (Vector similarity + Keyword + Heading matches)
      const { ranked, topSimilarity: maxSim } = rankChunks(
        queryEmbedding,
        allChunks,
        q,
        0.55
      );

      setTopSimilarity(maxSim);

      // Always retrieve the top matching chunks
      const topContextChunks = ranked.slice(0, 3);
      setMatchedChunks(topContextChunks);

      // Flag low confidence advisory if below 0.55, and log to Gap Report
      if (maxSim < 0.55) {
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
            contextChunks: topContextChunks.map((c) => ({
              citationIndex: c.citationIndex || 1,
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
        console.warn('Server chat route unavailable, using client-side RAG synthesis:', err);
      }

      // Resilient local synthesis fallback if server was unreachable or error on Vercel
      if (!generatedAnswer) {
        const top = topContextChunks[0];
        generatedAnswer = `According to **${top.heading}** in \`${top.file}\` [1]:\n\n${top.content.slice(0, 420)}...\n\nRefer to source citation [1] below for the complete section details.`;
      }

      setAnswer(generatedAnswer);
      if (maxSim >= 0.55) {
        toast.success('Retrieved matching sections and generated answer.');
      } else {
        toast.info('Retrieved closest matching sections for human review.');
      }
    } catch (err: any) {
      console.error('Ask docs error:', err);
      toast.error(err.message || 'An error occurred while querying documentation.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnswer = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success('Answer copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          Ask the Docs
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Search your documentation with numbered source citations. All matching sections are retrieved for human review.
        </p>
      </div>

      {/* Query Search Card */}
      <Card padding="md" className="border-[#E2E8F0]">
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
                placeholder="Ask any question from your documentation..."
                className="w-full h-10 pl-11 pr-4 rounded-[8px] border border-[#E2E8F0] bg-white text-sm text-[#1B2733] placeholder-slate-400 focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20 transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<Search className="w-4 h-4" />}
              className="shrink-0 font-semibold"
            >
              Search & Answer
            </Button>
          </div>

          {/* Quick sample chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Quick examples:</span>
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAsk(sq)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-[#00A3A1] hover:border-teal-200 border border-slate-200 text-slate-600 transition-colors text-left cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Low Confidence Advisory Banner (Does NOT block the answer!) */}
      {isLowConfidence && answer && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-[#b07b00] shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                Human Review Recommended (Relevance: {topSimilarity ? (topSimilarity * 100).toFixed(0) : 0}%)
              </span>
              <Badge variant="warning" size="sm">
                Low Confidence Match
              </Badge>
            </div>
            <p className="text-amber-800 leading-relaxed">
              The retrieved sections below have lower direct semantic overlap with your question. We are showing the closest matches so you can inspect them directly. This inquiry has also been saved to your <strong>Gap Report</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Answer Card with Numbered Citations */}
      {answer && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card
            borderVariant={isLowConfidence ? 'warning' : 'teal'}
            padding="md"
            title={
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00A3A1]" />
                <span>Grounded Documentation Answer</span>
              </div>
            }
            headerAction={
              <div className="flex items-center gap-2">
                <Badge variant={isLowConfidence ? 'warning' : 'accent'} size="sm">
                  Match Score: {topSimilarity ? (topSimilarity * 100).toFixed(0) : 0}%
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAnswer}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-[#2E9E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            }
          >
            <div className="prose prose-slate max-w-none text-sm text-[#1B2733] leading-relaxed whitespace-pre-wrap font-sans">
              {answer}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Referenced {matchedChunks.length} source section{matchedChunks.length > 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-slate-400">
                Grounded via Gemini RAG with citations
              </span>
            </div>
          </Card>

          {/* Source Chunks with Clickable Numbered Citations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00A3A1]" />
                <span>Source Citations (Review Matched Chunks)</span>
              </h3>
              <span className="text-xs text-slate-500">
                Click any citation to review the source text
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {matchedChunks.map((chunk) => {
                const isExpanded = expandedChunkId === chunk.id;
                return (
                  <div
                    key={chunk.id}
                    className="border border-[#E2E8F0] rounded-[10px] bg-white hover:border-[#00A3A1]/40 transition-colors shadow-xs overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#00A3A1] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {chunk.citationIndex}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-sm text-[#0B1F3A]">
                            {chunk.heading}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({chunk.file})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant={chunk.similarity >= 0.55 ? 'accent' : 'warning'}
                          size="sm"
                        >
                          {(chunk.similarity * 100).toFixed(0)}% match
                        </Badge>
                        <button className="text-slate-400 hover:text-slate-600 p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-[#E2E8F0] bg-white space-y-2 animate-in fade-in duration-150">
                        <div className="text-xs font-mono text-slate-500 flex items-center justify-between">
                          <span>Tokens: ~{chunk.tokens}</span>
                          <span>Source file: {chunk.file}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {chunk.content}
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
        <div className="py-12 border-2 border-dashed border-[#E2E8F0] rounded-[12px] bg-white/60 text-center flex flex-col items-center justify-center px-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-[#00A3A1] flex items-center justify-center mb-3">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">
            Ready to query your documentation
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Enter any technical question above. DocPilot searches all uploaded PDF, Word, and Markdown sections, retrieves the best matches, and provides an answer citing exact source files.
          </p>
        </div>
      )}
    </div>
  );
};
