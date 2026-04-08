import { useState, useEffect } from "react";
import { PlusCircle, Trash2, Folder, MessageSquare } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Chat {
  id: string;
  title: string;
  projectId: string;
}

import { Message } from "ai";

interface ChatSidebarProps {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  chatId: string | null;
  setChatId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
}

export default function ChatSidebar({
  projectId,
  setProjectId,
  chatId,
  setChatId,
  setMessages,
}: ChatSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    const mockProjects = [
       { id: "cm0abc123", name: "Project Gilly" },
       { id: "cm0xyz987", name: "Tech-Lead Stack" }
    ];
    setProjects(mockProjects);
  }, []);

  useEffect(() => {
    if (!projectId) {
       setChats([]);
       return;
    }
    const mockChats = [
       { id: "chat1", title: "Setup auth", projectId: projectId },
    ];
    setChats(mockChats);
  }, [projectId]);

  const startNewChat = () => {
    setChatId(null);
    setMessages([]);
  };

  const deleteChat = (id: string) => {
    setChats(chats.filter(c => c.id !== id));
    if (chatId === id) {
        startNewChat();
    }
  };

  return (
    <div className="w-64 bg-zinc-900 flex flex-col h-full border-r border-zinc-800">
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
            Select Project
          </label>
          <div className="relative">
            <Folder className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <select
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              value={projectId || ""}
              onChange={(e) => {
                 setProjectId(e.target.value);
                 startNewChat();
              }}
            >
              <option value="" disabled>Choose a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={startNewChat}
          disabled={!projectId}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-md py-2 px-4 transition-colors text-sm font-medium"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
         <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            History
         </div>
         {chats.length === 0 ? (
            <div className="text-zinc-500 text-sm italic px-2">No past chats.</div>
         ) : (
            <div className="space-y-1">
               {chats.map(c => (
                  <div
                     key={c.id}
                     className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm ${
                        chatId === c.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                     }`}
                     onClick={() => setChatId(c.id)}
                  >
                     <div className="flex items-center space-x-2 truncate">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate">{c.title}</span>
                     </div>
                     <button
                        onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1"
                     >
                        <Trash2 className="h-4 w-4" />
                     </button>
                  </div>
               ))}
            </div>
         )}
      </div>
    </div>
  );
}
