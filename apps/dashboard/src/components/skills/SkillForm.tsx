'use client';

import { submitSkill, validateSkill } from '@/app/api/skills/actions';
import EasyMDE from 'easymde';
import 'easymde/dist/easymde.min.css';
import matter from 'gray-matter';

import {
  frontmatterSchema,
  phaseEnum,
  kindEnum,
  domainEnum,
  ownershipDriveEnum,
  ownershipApproveEnum,
  targetsEnum,
  minModelClassEnum,
  artifactTypeEnum,
} from '@zenithfoundry/tech-lead-stack/skills/frontmatter-schema';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import SkillAssistant from './SkillAssistant';

const SimpleMdeReact = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

interface SkillFormProps {
  initialTemplate: string;
  projectName?: string;
}

export default function SkillForm({
  initialTemplate,
  projectName,
}: SkillFormProps) {
  const [content, setContent] = useState(initialTemplate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [serverFeedback, setServerFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<
    'idle' | 'validating' | 'submitting' | 'success' | 'error'
  >('idle');
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const validation = useMemo(() => {
    try {
      const parsed = matter(content);
      const validated = frontmatterSchema.safeParse(parsed.data);
      if (validated.success) {
        return { isValid: true, errors: [], data: parsed.data };
      } else {
        return {
          isValid: false,
          errors: validated.error.issues.map(
            (e) => `${e.path.join('.')}: ${e.message}`
          ),
          data: parsed.data,
        };
      }
    } catch (e: unknown) {
      const err = e as Error;
      return {
        isValid: false,
        errors: [`YAML parsing error: ${err.message}`],
        data: {},
      };
    }
  }, [content]);

  const handleFrontmatterChange = (field: string, value: any) => {
    try {
      const parsed = matter(content);
      const newData = { ...parsed.data };

      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newData[parent] = { ...newData[parent], [child]: value };
      } else {
        newData[field] = value;
      }

      const newContent = matter.stringify(parsed.content, newData);
      setContent(newContent);
      setServerFeedback(null);
      if (submissionStatus === 'success' || submissionStatus === 'error') {
        setSubmissionStatus('idle');
      }
    } catch (e) {
      console.error('Failed to update frontmatter', e);
    }
  };

  const parsedData = validation.data || {};
  const kind = parsedData.kind || 'skill';

  const { isValid, validationErrors } = {
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };

  const handleChange = (value: string) => {
    setContent(value);
    setServerFeedback(null);
    if (submissionStatus === 'success' || submissionStatus === 'error') {
      setSubmissionStatus('idle');
    }
  };

  const handleUpdateContent = (newContent: string) => {
    setContent(newContent);
    setServerFeedback(null);
    if (submissionStatus === 'success' || submissionStatus === 'error') {
      setSubmissionStatus('idle');
    }
  };

  const handleServerValidate = async () => {
    setIsValidating(true);
    setServerFeedback(null);
    try {
      const res = await validateSkill(content);
      if (res.success) {
        setServerFeedback({ type: 'success', message: res.message });
      } else {
        setServerFeedback({ type: 'error', message: res.message });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setServerFeedback({
        type: 'error',
        message: err.message || 'Validation failed',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionStatus('submitting');
    setServerFeedback(null);
    setPrUrl(null);

    try {
      // Step 1: Server Validation
      setServerFeedback({
        type: 'success',
        message: 'Validating skill on server...',
      });
      const valRes = await validateSkill(content);
      if (!valRes.success) {
        setSubmissionStatus('error');
        setServerFeedback({ type: 'error', message: valRes.message });
        setIsSubmitting(false);
        return;
      }

      // Step 2: GitHub Submission
      setServerFeedback({
        type: 'success',
        message: 'Connecting to GitHub and creating Draft PR...',
      });
      const res = await submitSkill(content);

      if (res.success) {
        setSubmissionStatus('success');
        setPrUrl(res.prUrl || null);
        setServerFeedback({
          type: 'success',
          message: res.message || 'Draft PR created successfully!',
        });
      } else {
        setSubmissionStatus('error');
        setServerFeedback({ type: 'error', message: res.message });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setSubmissionStatus('error');
      setServerFeedback({
        type: 'error',
        message: err.message || 'Submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const editorOptions = useMemo(() => {
    return {
      spellChecker: false,
      minHeight: '400px',
      status: ['lines', 'words', 'cursor'],
    } as unknown as EasyMDE.Options;
  }, []);

  return (
    <div className="flex md:flex-nowrap flex-wrap gap-6 h-[calc(100vh-12rem)] min-h-[600px] w-full">
      <div className="flex flex-col space-y-4 overflow-y-auto ">
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm shrink-0">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Frontmatter Form
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4 bg-muted/50 p-4 rounded border border-border">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Kind</label>
              <select
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                value={kind}
                onChange={(e) =>
                  handleFrontmatterChange('kind', e.target.value)
                }
              >
                {kindEnum.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {kind !== 'orchestrator' ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Phase</label>
                <select
                  className="border border-border rounded p-1 text-sm bg-background text-foreground"
                  value={parsedData.phase || ''}
                  onChange={(e) =>
                    handleFrontmatterChange('phase', e.target.value)
                  }
                >
                  <option value="">Select...</option>
                  {phaseEnum.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-sm font-medium">Spans (Phases)</label>
                <div className="flex flex-wrap gap-2 border border-border rounded p-2 bg-background">
                  {phaseEnum.options.map((o) => (
                    <label
                      key={o}
                      className="flex items-center gap-1 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={
                          Array.isArray(parsedData.spans) &&
                          parsedData.spans.includes(o)
                        }
                        onChange={(e) => {
                          const current = Array.isArray(parsedData.spans)
                            ? parsedData.spans
                            : [];
                          handleFrontmatterChange(
                            'spans',
                            e.target.checked
                              ? [...current, o]
                              : current.filter((s) => s !== o)
                          );
                        }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Domain</label>
              <select
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                value={parsedData.domain || ''}
                onChange={(e) =>
                  handleFrontmatterChange('domain', e.target.value)
                }
              >
                <option value="">Select...</option>
                {domainEnum.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Ownership.Drive</label>
              <select
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                value={parsedData.ownership?.drive || ''}
                onChange={(e) =>
                  handleFrontmatterChange('ownership.drive', e.target.value)
                }
              >
                <option value="">Select...</option>
                {ownershipDriveEnum.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Ownership.Approve</label>
              <select
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                value={parsedData.ownership?.approve || ''}
                onChange={(e) =>
                  handleFrontmatterChange('ownership.approve', e.target.value)
                }
              >
                <option value="">Select...</option>
                {ownershipApproveEnum.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Min Model Class</label>
              <select
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                value={parsedData.minModelClass || ''}
                onChange={(e) =>
                  handleFrontmatterChange('minModelClass', e.target.value)
                }
              >
                <option value="">Select...</option>
                {minModelClassEnum.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-sm font-medium">Targets</label>
              <div className="flex flex-wrap gap-2 border border-border rounded p-2 bg-background">
                {targetsEnum.options.map((o) => (
                  <label
                    key={o}
                    className="flex items-center gap-1 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(parsedData.targets) &&
                        parsedData.targets.includes(o)
                      }
                      onChange={(e) => {
                        const current = Array.isArray(parsedData.targets)
                          ? parsedData.targets
                          : [];
                        handleFrontmatterChange(
                          'targets',
                          e.target.checked
                            ? [...current, o]
                            : current.filter((s) => s !== o)
                        );
                      }}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 col-span-1 lg:col-span-3">
              <label className="text-sm font-medium">Consumes</label>
              <div className="flex flex-wrap gap-2 border border-border rounded p-2 bg-background max-h-32 overflow-y-auto">
                {artifactTypeEnum.options.map((o) => (
                  <label
                    key={o}
                    className="flex items-center gap-1 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(parsedData.consumes) &&
                        parsedData.consumes.includes(o)
                      }
                      onChange={(e) => {
                        const current = Array.isArray(parsedData.consumes)
                          ? parsedData.consumes
                          : [];
                        handleFrontmatterChange(
                          'consumes',
                          e.target.checked
                            ? [...current, o]
                            : current.filter((s) => s !== o)
                        );
                      }}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 col-span-1 lg:col-span-3">
              <label className="text-sm font-medium">Emits</label>
              <div className="flex flex-wrap gap-2 border border-border rounded p-2 bg-background max-h-32 overflow-y-auto">
                {artifactTypeEnum.options.map((o) => (
                  <label
                    key={o}
                    className="flex items-center gap-1 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(parsedData.emits) &&
                        parsedData.emits.includes(o)
                      }
                      onChange={(e) => {
                        const current = Array.isArray(parsedData.emits)
                          ? parsedData.emits
                          : [];
                        handleFrontmatterChange(
                          'emits',
                          e.target.checked
                            ? [...current, o]
                            : current.filter((s) => s !== o)
                        );
                      }}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Requires (comma sep)
              </label>
              <input
                type="text"
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                placeholder="skill-a, skill-b"
                value={
                  Array.isArray(parsedData.requires)
                    ? parsedData.requires.join(', ')
                    : ''
                }
                onChange={(e) =>
                  handleFrontmatterChange(
                    'requires',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Suggests (comma sep)
              </label>
              <input
                type="text"
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                placeholder="skill-c"
                value={
                  Array.isArray(parsedData.suggests)
                    ? parsedData.suggests.join(', ')
                    : ''
                }
                onChange={(e) =>
                  handleFrontmatterChange(
                    'suggests',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Policies (comma sep)
              </label>
              <input
                type="text"
                className="border border-border rounded p-1 text-sm bg-background text-foreground"
                placeholder="policy-x"
                value={
                  Array.isArray(parsedData.policies)
                    ? parsedData.policies.join(', ')
                    : ''
                }
                onChange={(e) =>
                  handleFrontmatterChange(
                    'policies',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
          </div>
          {isValid ? (
            <div className="flex items-center text-green-600 font-medium">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              ✅ Frontmatter valid
            </div>
          ) : (
            <div className="text-red-500">
              <div className="flex items-center font-medium mb-2">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
                ❌ Invalid Frontmatter
              </div>
              <ul className="list-disc list-inside text-sm pl-2">
                {validationErrors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="w-full border border-border rounded-lg overflow-hidden prose-editor flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            <SimpleMdeReact
              value={content}
              onChange={handleChange}
              options={editorOptions}
            />
          </div>
        </div>

        {serverFeedback && (
          <div
            className={`p-4 rounded-lg shrink-0 ${
              serverFeedback.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-red-50 text-red-700 border border-red-100'
            }`}
          >
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                {isSubmitting && (
                  <svg
                    className="animate-spin h-4 w-4 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                <span className="text-sm font-medium">
                  {serverFeedback.message}
                </span>
              </div>

              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 w-fit"
                >
                  View Pull Request on GitHub
                  <svg
                    className="ml-1 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    ></path>
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex space-x-4 shrink-0 pb-4">
          <button
            onClick={handleServerValidate}
            disabled={!isValid || isValidating || isSubmitting}
            className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-accent focus:outline-none disabled:opacity-50 transition-colors"
          >
            {isValidating ? 'Validating...' : 'Validate on Server'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting || isValidating}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              'Submit Draft PR'
            )}
          </button>
        </div>
      </div>

      <div className="hidden lg:block h-full w-1/3">
        <SkillAssistant
          currentContent={content}
          onUpdateContent={handleUpdateContent}
          projectName={projectName}
        />
      </div>

      <div className="lg:hidden h-[500px]">
        <SkillAssistant
          currentContent={content}
          onUpdateContent={handleUpdateContent}
          projectName={projectName}
        />
      </div>
    </div>
  );
}
