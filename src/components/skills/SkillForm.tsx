'use client';

import { submitSkill, validateSkill } from '@/app/api/skills/actions';
import EasyMDE from 'easymde';
import 'easymde/dist/easymde.min.css';
import matter from 'gray-matter';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SkillAssistant from './SkillAssistant';

const SimpleMdeReact = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

interface SkillFormProps {
  initialTemplate: string;
}

export default function SkillForm({ initialTemplate }: SkillFormProps) {
  const [content, setContent] = useState(initialTemplate);
  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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

  const validateFrontmatter = useCallback((mdContent: string) => {
    try {
      const parsed = matter(mdContent);
      const errors: string[] = [];
      const data = parsed.data;

      if (!data.name) errors.push("Missing 'name' in frontmatter");
      if (!data.description)
        errors.push("Missing 'description' in frontmatter");
      if (!data.cost) errors.push("Missing 'cost' in frontmatter");

      if (errors.length > 0) {
        setIsValid(false);
        setValidationErrors(errors);
      } else {
        setIsValid(true);
        setValidationErrors([]);
      }
    } catch (e: unknown) {
      const err = e as Error;
      setIsValid(false);
      setValidationErrors([`YAML parsing error: ${err.message}`]);
    }
  }, []);

  useEffect(() => {
    validateFrontmatter(content);
  }, [content, validateFrontmatter]);

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
      setServerFeedback({ type: 'success', message: 'Validating skill on server...' });
      const valRes = await validateSkill(content);
      if (!valRes.success) {
        setSubmissionStatus('error');
        setServerFeedback({ type: 'error', message: valRes.message });
        setIsSubmitting(false);
        return;
      }

      // Step 2: GitHub Submission
      setServerFeedback({ type: 'success', message: 'Connecting to GitHub and creating Draft PR...' });
      const res = await submitSkill(content);
      
      if (res.success) {
        setSubmissionStatus('success');
        setPrUrl(res.prUrl || null);
        setServerFeedback({ 
          type: 'success', 
          message: res.message || 'Draft PR created successfully!' 
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
            Frontmatter Status
          </h2>
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
                {validationErrors.map((err, i) => (
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
                  <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span className="text-sm font-medium">{serverFeedback.message}</span>
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
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        />
      </div>

      <div className="lg:hidden h-[500px]">
        <SkillAssistant
          currentContent={content}
          onUpdateContent={handleUpdateContent}
        />
      </div>
    </div>
  );
}
