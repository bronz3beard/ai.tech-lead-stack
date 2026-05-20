import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WriteToSandboxArgs } from '../types';
import { scanFileSystem } from '../utils/fs-helpers';

interface UseDiscoveryChatProps {
  selectedProjectId: string;
  figmaUrl?: string;
  branchUrl?: string;
  componentName?: string;
  handleWriteFile: (path: string, content: string) => Promise<void>;
  getWebContainer: () => any;
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
  getWebContainer,
  selectedFile,
  setFileContent,
  setWrittenFiles,
  setSandboxError,
}: UseDiscoveryChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedToolCalls = useRef<Set<string>>(new Set());
  const consecutiveToolCallsCount = useRef(0);

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

  const { messages, status, sendMessage, addToolOutput, stop } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
    async onToolCall({ toolCall }) {
      consecutiveToolCallsCount.current++;
      if (consecutiveToolCallsCount.current > 10) {
        console.warn(
          `[onToolCall] Safety threshold of 10 consecutive tool calls exceeded for tool: ${toolCall.toolName}. Instructing agent to proceed to code updates.`
        );
        toast.warning(
          'Tool call safety threshold reached. Instructing the agent to finalize changes and show code updates.'
        );

        addToolOutput({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName,
          state: 'output-error',
          errorText: 'Safety limit of 10 consecutive tool calls exceeded. You have made enough tool calls now. Do not call any more tools. It is time for you to start working on the code, show your updates, and explain your changes to the user.',
        });
        return;
      }

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
      } else if (toolCall.toolName === 'read_sandbox_file') {
        const args =
          (toolCall as any).args ||
          (toolCall as any).input ||
          (toolCall as any).parameters ||
          {};
        const { path } = args as { path: string };

        if (!path) {
          console.warn(
            '[onToolCall] Received incomplete arguments for read_sandbox_file',
            toolCall
          );
          return;
        }

        console.log(`[onToolCall] Reading file from sandbox: ${path}`);

        try {
          let container = getWebContainer();
          if (!container) {
            console.log(
              '[onToolCall] WebContainer not ready for read_sandbox_file, polling...'
            );
            for (let i = 0; i < 30; i++) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              container = getWebContainer();
              if (container) break;
            }
          }

          if (!container) {
            throw new Error('Sandbox development environment is not initialized yet.');
          }

          const content = await container.fs.readFile(path, 'utf-8');

          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: { success: true, path, content },
          });
        } catch (error: any) {
          console.error(
            `[onToolCall] Failed to read from sandbox: ${path}`,
            error
          );
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (toolCall.toolName === 'list_sandbox_files') {
        console.log('[onToolCall] Listing sandbox files');

        try {
          let container = getWebContainer();
          if (!container) {
            console.log(
              '[onToolCall] WebContainer not ready for list_sandbox_files, polling...'
            );
            for (let i = 0; i < 30; i++) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              container = getWebContainer();
              if (container) break;
            }
          }

          if (!container) {
            throw new Error('Sandbox development environment is not initialized yet.');
          }

          const allFiles = await scanFileSystem(container);
          const filePaths = allFiles.map((f) => f.path);

          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: { success: true, files: filePaths },
          });
        } catch (error: any) {
          console.error(
            '[onToolCall] Failed to list files from sandbox',
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

    consecutiveToolCallsCount.current = 0; // Reset consecutive safety counter

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

