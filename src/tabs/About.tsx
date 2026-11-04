/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldCheck,
  Bot,
  UserCheck,
  Database,
  Lock,
  Compass,
  AlertTriangle,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

export const About: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          About & AI Disclosure
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Transparency manifest on artificial intelligence assistance, human-in-the-loop review policy,
          and vector database architecture.
        </p>
      </div>

      {/* Core Mission Banner */}
      <Card
        padding="lg"
        borderVariant="teal"
        className="bg-gradient-to-r from-teal-50/50 via-white to-slate-50 border-teal-200"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="accent" size="sm">
                DocPilot Governance Policy v2.4
              </Badge>
              <Badge variant="outline" size="sm">
                ISO / IEEE Technical Comm. Guidelines
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
              Human-Governed, AI-Accelerated Documentation
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              DocPilot is an AI documentation workbench designed exclusively for technical writers,
              developer advocates, and API architects. We treat Large Language Models as assistive
              co-pilots: AI generates draft options and semantic vectors, while humans retain absolute
              editorial authority, code accuracy validation, and publishing approval.
            </p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-[#00A3A1] text-white flex items-center justify-center shrink-0 shadow-md">
            <Compass className="w-8 h-8" />
          </div>
        </div>
      </Card>

      {/* Division of Responsibilities Grid: AI vs Human */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: AI-Assisted Tasks */}
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2 text-[#00A3A1]">
              <Bot className="w-5 h-5" />
              <span>What is AI-Assisted</span>
            </div>
          }
          subtitle="Automated operations powered by Gemini models and vector arithmetic"
        >
          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A3A1] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Semantic Embedding & Vector Search</strong>
                Generating dense embeddings via <code className="text-teal-700 font-mono">gemini-embedding-2-preview</code> to index documentation chunks.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A3A1] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">RAG Synthesis with Numbered Citations</strong>
                Formulating natural language answers in Tab 1 strictly grounded in retrieved documentation passages, with bracketed citations [1], [2].
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A3A1] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Style Refactoring Drafts</strong>
                Rewriting drafts in Tab 4 into active voice, imperative steps, and concise technical syntax based on Google Dev Docs standards.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A3A1] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Release Note Categorization</strong>
                Classifying messy git commit logs into structured changelog sections (Features, Bug Fixes, Breaking Changes).
              </div>
            </li>
          </ul>
        </Card>

        {/* Card: Strictly Human Responsibilities */}
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2 text-[#0B1F3A]">
              <UserCheck className="w-5 h-5 text-[#2E9E6B]" />
              <span>What is Strictly Human</span>
            </div>
          }
          subtitle="Non-delegable technical writer verification & oversight"
        >
          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Mandatory Verification Checkpoint</strong>
                The &ldquo;Human verified&rdquo; checkbox in Tab 4 blocks all Markdown file exports until a human author reviews the text.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Code & API Specification Testing</strong>
                Human engineers test curl commands, SDK syntax, endpoint paths, and payload schemas against live sandbox servers.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Security & Deprecation Authority</strong>
                Humans make final determinations regarding token rotation guidelines, sunset schedules, and vulnerability disclosures.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] shrink-0 mt-1.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Gap Report Resolution</strong>
                Technical writers inspect unanswered queries in Tab 7 and author authoritative new documentation sections.
              </div>
            </li>
          </ul>
        </Card>
      </div>

      {/* Safety & Fallback Policies */}
      <Card
        padding="md"
        title="Safety Guardrails & Accuracy Architecture"
        subtitle="How DocPilot prevents hallucinations and protects customer documentation"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#F2A900] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#b07b00]" />
            </div>
            <h3 className="text-sm font-semibold text-[#0B1F3A]">
              0.55 Similarity Cutoff
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              If the top cosine match falls below 0.55 in Ask the Docs, DocPilot refuses to hallucinate
              an answer. Instead, it surfaces an amber &ldquo;Not found in docs&rdquo; warning and logs
              the inquiry to the Gap Report.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#0B1F3A]">
              Server-Side Proxy Security
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              All Gemini API requests execute strictly through backend serverless routes in <code className="font-mono">/api</code>.
              API keys are never exposed to browser runtimes, and user documents are not used for public model training.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#00A3A1] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#0B1F3A]">
              Supabase pgvector & Fallback
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Storage is abstracted behind <code className="font-mono">src/lib/store.ts</code>. You can deploy with
              Supabase pgvector or use the embedded JSON fallback vector store for instant, zero-configuration local runs.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
