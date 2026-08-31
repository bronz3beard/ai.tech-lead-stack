'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ProjectSelect, type Project } from '@/components/ProjectSelect';
import { Label } from '@/components/ui/label';

// Mirrors ReflexionResult from '@/lib/ai/reflexion/engine'.
interface Critique {
  gstackDiagnosis: number;
  atomicBatches: number;
  productionEthos: number;
  modernWeb: number;
  score: number;
  passed: boolean;
  actionableFix: string;
}

interface Question {
  id: string;
  target: 'plan' | 'loop';
  ref: string;
  question: string;
  why: string;
}

interface Interview {
  runId: string;
  revision: number;
  recommendation: 'approve' | 'refine-plan' | 'tune-loop' | 'stop';
  questions: Question[];
}

interface ReflexionResult {
  runId?: string;
  status?: string;
  interview?: Interview;
  rounds: { revision: number; draft: string; critique: Critique }[];
  scores: number[];
  finalScore: number;
  finalPassed: boolean;
  revisionsUsed: number;
  verdict: string;
  idePrompt: string;
  models: { creator: string; critic: string; adjudicator: string };
  usage?: { estimatedCacheSavingsUsd?: number };
}

const PASS_THRESHOLD = 8;

interface ReflexionClientProps {
  projects: Project[];
}

export default function ReflexionClient({ projects }: ReflexionClientProps) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReflexionResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Interview state
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function copyPrompt() {
    if (!result) return;
    await navigator.clipboard.writeText(result.idePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const res = await fetch('/api/orchestrator/reflexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          projectId,
          passThreshold: PASS_THRESHOLD,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      setResult(data as ReflexionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  async function submitInterview(directive?: 'approve' | 'stop') {
    if (!result?.interview?.runId) return;
    setLoading(true);
    setError(null);
    try {
      const decisions = Object.entries(answers).map(([id, answer]) => ({ id, answer }));
      const payload = {
        runId: result.interview.runId,
        decisions,
        directive
      };

      const res = await fetch('/api/orchestrator/reflexion/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resume failed');
      setResult(data as ReflexionResult);
      if (!data.interview) {
        setAnswers({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resume failed');
    } finally {
      setLoading(false);
    }
  }

  const handleAnswerChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const finalPlan = result?.rounds?.at(-1)?.draft ?? '';
  const finalCritique = result?.rounds?.at(-1)?.critique;
  const chartData = result?.scores?.map((s, i) => ({ revision: i, score: s })) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Reflexion Loop</h1>
        <Badge variant="default">New</Badge>
        <Badge variant="secondary">Requires API keys</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        A self-correcting loop: <strong>Gemini</strong> drafts an implementation
        plan, <strong>Claude</strong> grades it against the Four Pillars and
        hands back one fix, and the loop repeats until it passes or hits the cap.
        Uses your saved Gemini and Claude keys (Settings).
      </p>

      {/* How it works */}
      <Card className="bg-muted/30 border-muted-foreground/10">
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-2">
          <h3 className="font-semibold text-foreground text-sm">How it works</h3>
          <ol className="list-decimal pl-4 space-y-1.5 leading-normal">
            <li>
              <strong>Select a Project:</strong> Choose one of your authorized projects to ground the loop in the target repository.
            </li>
            <li>
              <strong>Context Extraction:</strong> The orchestrator parses the project configuration (like <code>package.json</code> and <code>tsconfig.json</code>) to provide direct context to the models.
            </li>
            <li>
              <strong>Self-Correcting Loop:</strong> <strong>Gemini</strong> drafts the implementation plan, <strong>Claude</strong> evaluates it against the Four Pillars and provides a single actionable fix, and the loop repeats until it meets the passing score.
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Read-only.</strong> This page never modifies code. It produces a
        reviewed plan and a copy-paste <em>IDE prompt</em> you take to Cursor /
        Continue / Antigravity / Claude Code to implement. To run code-changing workflows,
        use the MCP <code>reflexion_loop</code> tool from your IDE.
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Brief</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Project:</span>
              <ProjectSelect
                projects={projects}
                selectedProjectId={projectId}
                placeholder="Select project..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={
              projectId
                ? "e.g. Add token-bucket rate limiting to the public REST API, configurable per API key."
                : "Please select a project first to enable the brief input."
            }
            disabled={!projectId}
            rows={4}
          />
          <Button onClick={run} disabled={loading || brief.trim().length < 8 || !projectId}>
            {loading ? 'Running loop…' : 'Run Reflexion'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {result?.interview && result.interview.questions.length > 0 && (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-blue-400">Adjudicator Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              The Adjudicator requires your input to proceed. Please answer the questions below to guide the next revision, or choose to approve or stop the process.
            </p>
            {result.interview.questions.map((q) => (
              <div key={q.id} className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`q-${q.id}`} className="font-semibold text-sm">
                    {q.question}
                  </Label>
                  <Badge variant="outline">{q.target === 'plan' ? 'plan ' + q.ref : 'loop ' + q.ref}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{q.why}</p>
                <Textarea
                  id={`q-${q.id}`}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Your answer..."
                  rows={2}
                />
              </div>
            ))}

            <div className="flex gap-2 pt-4 mt-4 border-t">
              <Button onClick={() => submitInterview()} disabled={loading} className="flex-1">
                Submit Answers
              </Button>
              <Button variant="outline" onClick={() => submitInterview('approve')} disabled={loading}>
                Approve As-Is
              </Button>
              <Button variant="destructive" onClick={() => submitInterview('stop')} disabled={loading}>
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.status !== 'AWAITING_INTERVIEW' && result.verdict && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Verdict
                <Badge variant={result.finalPassed ? 'default' : 'destructive'}>
                  {result.finalScore}/10 {result.finalPassed ? 'passed' : 'capped'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{result.verdict}</p>
              <p className="text-muted-foreground">
                {result.models.creator} drafted · {result.models.critic} graded ·{' '}
                {result.revisionsUsed} revision(s)
              </p>
              {result.usage?.estimatedCacheSavingsUsd != null && result.usage.estimatedCacheSavingsUsd > 0 && (
                <p className="text-muted-foreground text-emerald-600 dark:text-emerald-400">
                  Cache savings: ${result.usage.estimatedCacheSavingsUsd.toFixed(4)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diminishing returns</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="revision" label={{ value: 'Revision', position: 'insideBottom', offset: -4 }} />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <ReferenceLine y={PASS_THRESHOLD} stroke="#ef4444" strokeDasharray="4" label="pass" />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              {finalCritique && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>G-Stack: {finalCritique.gstackDiagnosis}/10</span>
                  <span>Atomic: {finalCritique.atomicBatches}/10</span>
                  <span>Ethos: {finalCritique.productionEthos}/10</span>
                  <span>Modern web: {finalCritique.modernWeb}/10</span>
                </div>
              )}
            </CardContent>
          </Card>

          {result.idePrompt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>IDE prompt</span>
                  <Button variant="secondary" onClick={copyPrompt}>
                    {copied ? 'Copied' : 'Copy for IDE'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Paste this into your IDE agent to implement the reviewed plan.
                  The looping is already done — this is the hardened hand-off.
                </p>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                  {result.idePrompt}
                </pre>
              </CardContent>
            </Card>
          )}

          {finalPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Final plan</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalPlan}</ReactMarkdown>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
