/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Flag,
  Save,
  Plus,
  Trash2,
  Clock,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { useDocStore, PromptVersion } from '../lib/store';

export const PromptLab: React.FC = () => {
  const store = useDocStore();
  const toast = useToast();

  const prompts = store.getPrompts();

  const [versionAId, setVersionAId] = useState(prompts[0]?.id || '');
  const [versionBId, setVersionBId] = useState(prompts[1]?.id || prompts[0]?.id || '');
  const [testInput, setTestInput] = useState(
    'How should developers handle HTTP 429 rate limit errors when calling the batch endpoint?'
  );

  const [isRunning, setIsRunning] = useState(false);
  const [outputA, setOutputA] = useState<{ text: string; latencyMs: number } | null>(null);
  const [outputB, setOutputB] = useState<{ text: string; latencyMs: number } | null>(null);

  // Hallucination flag states
  const [flaggedA, setFlaggedA] = useState(false);
  const [flagReasonA, setFlagReasonA] = useState('');
  const [flaggedB, setFlaggedB] = useState(false);
  const [flagReasonB, setFlagReasonB] = useState('');

  // New prompt version form modal/state
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSystem, setFormSystem] = useState('');
  const [formTemplate, setFormTemplate] = useState('');

  const versionA = prompts.find((p) => p.id === versionAId) || prompts[0];
  const versionB = prompts.find((p) => p.id === versionBId) || prompts[1] || prompts[0];

  const handleRunComparison = async () => {
    if (!testInput.trim()) {
      toast.warning('Please enter a test input query.');
      return;
    }
    if (!versionA || !versionB) {
      toast.error('Please select both versions for comparison.');
      return;
    }

    setIsRunning(true);
    setOutputA(null);
    setOutputB(null);
    setFlaggedA(false);
    setFlaggedB(false);

    try {
      // Run both in parallel
      const [resA, resB] = await Promise.all([
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prompt_run',
            systemPrompt: versionA.systemPrompt,
            template: versionA.template,
            input: testInput,
          }),
        }),
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prompt_run',
            systemPrompt: versionB.systemPrompt,
            template: versionB.template,
            input: testInput,
          }),
        }),
      ]);

      const dataA = await resA.json();
      const dataB = await resB.json();

      setOutputA({ text: dataA.output, latencyMs: dataA.latencyMs || 250 });
      setOutputB({ text: dataB.output, latencyMs: dataB.latencyMs || 280 });
      toast.success('Prompt comparison run completed.');
    } catch (err: any) {
      console.error('Prompt Lab run failed:', err);
      toast.error(err.message || 'Failed to execute prompt comparison');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveNewPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSystem.trim()) {
      toast.warning('Please enter prompt name and system instructions.');
      return;
    }

    const newPrompt: PromptVersion = {
      id: `prompt-${Date.now()}`,
      name: formName.trim(),
      description: formDesc.trim() || 'Custom prompt iteration',
      systemPrompt: formSystem.trim(),
      template: formTemplate.trim() || 'Context:\n{{context}}\n\nQuestion:\n{{question}}\n\nAnswer:',
      createdAt: new Date().toISOString(),
    };

    store.savePrompt(newPrompt);
    toast.success(`Saved prompt version "${newPrompt.name}".`);
    setIsEditingPrompt(false);
    setVersionBId(newPrompt.id);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
            Prompt Lab
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Compare two prompt styles side-by-side with identical inputs to find the most accurate instructions.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setFormName(`v${prompts.length + 1}: Custom Style`);
            setFormDesc('Specialized technical prompt template');
            setFormSystem('You are a technical documentation assistant...');
            setFormTemplate('Documentation:\n{{context}}\n\nQuestion:\n{{question}}\n\nAnswer:');
            setIsEditingPrompt(true);
          }}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Prompt Version
        </Button>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>💡 How to use & what happens:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Choose versions:</strong> Pick Version A and Version B (e.g. Concise vs Step-by-Step).
          <br />
          <strong>2. Run comparison:</strong> Enter a sample question and click &ldquo;Run Side-by-Side Comparison&rdquo;. Both versions process the input simultaneously.
          <br />
          <strong>3. Audit accuracy:</strong> Check response quality. If an answer invents a non-existent parameter, click <strong>&ldquo;Flag Hallucination&rdquo;</strong> to record the issue.
        </p>
      </div>

      {/* Test Query and Run Bar */}
      <Card padding="md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Test Input / Query
            </label>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter a prompt test query..."
              className="w-full h-10 px-4 rounded-lg border border-[#E2E8F0] text-sm text-slate-800 focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">
              Comparing Version A vs Version B simultaneously across identical seed context.
            </span>
            <Button
              variant="primary"
              isLoading={isRunning}
              onClick={handleRunComparison}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Run Side-by-Side Comparison
            </Button>
          </div>
        </div>
      </Card>

      {/* Side-by-Side Version Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Version A Card */}
        <div className="space-y-4">
          <Card
            padding="md"
            title={
              <div className="flex items-center justify-between w-full">
                <span className="text-[#0B1F3A] font-semibold">Version A</span>
                <select
                  value={versionAId}
                  onChange={(e) => setVersionAId(e.target.value)}
                  className="h-8 px-2 rounded border border-[#E2E8F0] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00A3A1]"
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            }
            subtitle={versionA?.description}
          >
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 max-h-24 overflow-y-auto">
                <span className="font-semibold text-slate-500 block mb-0.5">System Prompt:</span>
                {versionA?.systemPrompt}
              </div>

              {/* Output Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Generated Output
                  </span>
                  {outputA && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {outputA.latencyMs}ms
                      </span>
                      <button
                        onClick={() => setFlaggedA(!flaggedA)}
                        className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                          flaggedA
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        <Flag className="w-3 h-3" />
                        {flaggedA ? 'Hallucination Flagged' : 'Flag Hallucination'}
                      </button>
                    </div>
                  )}
                </div>

                {outputA ? (
                  <div
                    className={`p-4 rounded-lg border text-xs font-mono leading-relaxed whitespace-pre-wrap min-h-48 ${
                      flaggedA
                        ? 'bg-red-50/40 border-red-300 text-slate-900'
                        : 'bg-white border-[#E2E8F0] text-slate-800'
                    }`}
                  >
                    {outputA.text}
                  </div>
                ) : (
                  <div className="h-48 border-2 border-dashed border-[#E2E8F0] rounded-lg flex items-center justify-center text-xs text-slate-400">
                    Awaiting execution...
                  </div>
                )}

                {flaggedA && (
                  <div className="mt-2 p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                    <span className="font-semibold block">Flag Details:</span>
                    <input
                      type="text"
                      placeholder="e.g. Invented non-existent Retry-Window header"
                      value={flagReasonA}
                      onChange={(e) => setFlagReasonA(e.target.value)}
                      className="w-full h-7 px-2 text-xs bg-white rounded border border-red-200 text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Version B Card */}
        <div className="space-y-4">
          <Card
            padding="md"
            title={
              <div className="flex items-center justify-between w-full">
                <span className="text-[#0B1F3A] font-semibold">Version B</span>
                <select
                  value={versionBId}
                  onChange={(e) => setVersionBId(e.target.value)}
                  className="h-8 px-2 rounded border border-[#E2E8F0] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00A3A1]"
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            }
            subtitle={versionB?.description}
          >
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 max-h-24 overflow-y-auto">
                <span className="font-semibold text-slate-500 block mb-0.5">System Prompt:</span>
                {versionB?.systemPrompt}
              </div>

              {/* Output Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Generated Output
                  </span>
                  {outputB && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {outputB.latencyMs}ms
                      </span>
                      <button
                        onClick={() => setFlaggedB(!flaggedB)}
                        className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                          flaggedB
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        <Flag className="w-3 h-3" />
                        {flaggedB ? 'Hallucination Flagged' : 'Flag Hallucination'}
                      </button>
                    </div>
                  )}
                </div>

                {outputB ? (
                  <div
                    className={`p-4 rounded-lg border text-xs font-mono leading-relaxed whitespace-pre-wrap min-h-48 ${
                      flaggedB
                        ? 'bg-red-50/40 border-red-300 text-slate-900'
                        : 'bg-white border-[#E2E8F0] text-slate-800'
                    }`}
                  >
                    {outputB.text}
                  </div>
                ) : (
                  <div className="h-48 border-2 border-dashed border-[#E2E8F0] rounded-lg flex items-center justify-center text-xs text-slate-400">
                    Awaiting execution...
                  </div>
                )}

                {flaggedB && (
                  <div className="mt-2 p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                    <span className="font-semibold block">Flag Details:</span>
                    <input
                      type="text"
                      placeholder="e.g. Made up 429 Retry-After milliseconds assumption"
                      value={flagReasonB}
                      onChange={(e) => setFlagReasonB(e.target.value)}
                      className="w-full h-7 px-2 text-xs bg-white rounded border border-red-200 text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* New Prompt Modal */}
      {isEditingPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Create New Prompt Version
            </h3>

            <form onSubmit={handleSaveNewPrompt} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Version Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description / Persona
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full h-8 px-3 rounded border border-[#E2E8F0] text-xs text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  System Instructions
                </label>
                <textarea
                  rows={4}
                  required
                  value={formSystem}
                  onChange={(e) => setFormSystem(e.target.value)}
                  className="w-full p-2.5 rounded border border-[#E2E8F0] text-xs font-mono text-slate-800 focus:outline-none focus:border-[#00A3A1]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setIsEditingPrompt(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  Save Version
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
