import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WriteToSandboxArgs } from '../types';

interface UseDiscoveryChatProps {
  selectedProjectId: string;
  figmaUrl?: string;
  branchUrl?: string;
  componentName?: string;
  handleWriteFile: (path: string, content: string) => Promise<void>;
  selectedFile: string | null;
  setFileContent: (content: string) => void;
  setWrittenFiles: React.Dispatch<
    React.SetStateAction<
      { path: string; status: 'writing' | 'done' | 'error' }[]
    >
  >;
  setSandboxError: (err: string | null) => void;
}

export function useDiscoveryChat({
  selectedProjectId,
  figmaUrl,
  branchUrl,
  componentName,
  handleWriteFile,
  selectedFile,
  setFileContent,
  setWrittenFiles,
  setSandboxError,
}: UseDiscoveryChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedToolCalls = useRef<Set<string>>(new Set());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/orchestrator/discovery',
        body: {
          projectId: selectedProjectId,
          figmaUrl,
          branchUrl,
          componentName,
        },
      }),
    [selectedProjectId, figmaUrl, branchUrl, componentName]
  );

  const { messages, status, sendMessage, addToolOutput } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'write_to_sandbox') {
        const args =
          (toolCall as any).args ||
          (toolCall as any).input ||
          (toolCall as any).parameters ||
          {};
        const { path, content } = args as WriteToSandboxArgs;

        if (!path || !content) {
          console.warn(
            '[onToolCall] Received incomplete arguments for write_to_sandbox',
            toolCall
          );
          return;
        }

        console.log(`[onToolCall] Writing to sandbox: ${path}`);

        processedToolCalls.current.add(toolCall.toolCallId);

        try {
          await handleWriteFile(path, content);

          if (selectedFile === path) {
            setFileContent(content);
          }

          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: { success: true, path },
          });
        } catch (error: any) {
          console.error(
            `[onToolCall] Failed to write to sandbox: ${path}`,
            error
          );
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
    onError: (err) => {
      console.error('Chat error:', err);
      setSandboxError(`Stream error: ${err.message}`);
      toast.error(`Discovery Error: ${err.message}`);
    },
    onFinish: (message) => {
      console.log('Chat finished:', message);
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  // Keep visual sync for streaming tool calls
  useEffect(() => {
    messages.forEach((message: any) => {
      if (message.toolInvocations) {
        message.toolInvocations.forEach((invocation: any) => {
          const { toolCallId, toolName } = invocation;
          const args =
            invocation.args || invocation.input || invocation.parameters || {};

          if (
            toolName === 'write_to_sandbox' &&
            args?.path &&
            !processedToolCalls.current.has(toolCallId)
          ) {
            setWrittenFiles((prev) => {
              const exists = prev.find((f) => f.path === args.path);
              if (exists) return prev;
              return [...prev, { path: args.path, status: 'writing' }];
            });
          }
        });
      }
    });
  }, [messages, setWrittenFiles]);

  const isLoading = status === 'streaming';

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage(
      { parts: [{ type: 'text', text: input }] },
      { body: { projectId: selectedProjectId } }
    );
    setInput('');
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages,
    input,
    isLoading,
    scrollRef,
    handleInputChange,
    handleSubmit,
  };
}
