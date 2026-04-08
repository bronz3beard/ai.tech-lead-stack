import { useState, useRef, useEffect } from "react";
import { Send, Command } from "lucide-react";
import { useSession } from "next-auth/react";
import { getWorkflowsForRole } from "@/lib/workflow-roles";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export default function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) {
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user && (session.user as any).role) {
       const userWorkflows = getWorkflowsForRole((session.user as any).role);
       setWorkflows(userWorkflows);
    }
  }, [session]);

  useEffect(() => {
    if (input.startsWith("/")) {
       setShowWorkflows(true);
    } else {
       setShowWorkflows(false);
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
         form.requestSubmit();
      }
    }
  };

  const insertWorkflow = (workflowName: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter && textareaRef.current) {
        nativeInputValueSetter.call(textareaRef.current, `/${workflowName} `);
        const ev2 = new Event("input", { bubbles: true });
        textareaRef.current.dispatchEvent(ev2);
    }

    setShowWorkflows(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative max-w-4xl mx-auto">
      {showWorkflows && workflows.length > 0 && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
           <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-700 text-xs font-semibold text-zinc-400 flex items-center">
             <Command className="h-3 w-3 mr-2" />
             AVAILABLE WORKFLOWS
           </div>
           <ul>
              {workflows
                 .filter(w => `/${w}`.startsWith(input.split(' ')[0]))
                 .map(w => (
                 <li
                   key={w}
                   className="px-4 py-2 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-200"
                   onClick={() => insertWorkflow(w)}
                 >
                    <span className="font-mono text-indigo-400 mr-2">/{w}</span>
                 </li>
              ))}
           </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex items-end w-full">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message or type '/' for workflows..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-4 pr-12 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden min-h-[56px] text-zinc-100 placeholder-zinc-500 shadow-inner"
          rows={1}
          style={{ height: "auto", maxHeight: "200px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 bottom-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      <div className="text-center mt-2">
         <span className="text-[10px] text-zinc-500">Press Shift+Enter for new line. AI can make mistakes. Check important info.</span>
      </div>
    </div>
  );
}
