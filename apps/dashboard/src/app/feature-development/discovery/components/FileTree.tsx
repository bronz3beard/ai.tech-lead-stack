import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Loader2,
  FileCode,
} from 'lucide-react';
import { FileNode } from '../types';

interface FileTreeProps {
  fileTree: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

export function FileTree({
  fileTree,
  selectedFile,
  onSelectFile,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['src', 'app', 'components', 'libs'])
  );

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTree = (nodes: FileNode[], level = 0): React.ReactNode[] => {
    return nodes.map((node) => (
      <div key={node.path}>
        {node.isDirectory ? (
          <div>
            <button
              onClick={() => toggleFolder(node.path)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-[11px] text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all group"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {expandedFolders.has(node.path) ? (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
              <Folder className="w-3.5 h-3.5 text-blue-500/60" />
              <span className="truncate">{node.name}</span>
            </button>
            {expandedFolders.has(node.path) && node.children && (
              <div className="animate-in slide-in-from-left-1 duration-200">
                {renderTree(node.children, level + 1)}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onSelectFile(node.path)}
            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-[11px] transition-all group border ${
              selectedFile === node.path
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30'
                : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'
            }`}
            style={{ paddingLeft: `${level * 12 + 24}px` }}
          >
            <div className="flex items-center gap-2 truncate">
              {node.status === 'writing' ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              ) : (
                <FileCode
                  className={`w-3.5 h-3.5 ${
                    selectedFile === node.path
                      ? 'text-blue-400'
                      : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                />
              )}
              <span className="truncate">{node.name}</span>
            </div>
          </button>
        )}
      </div>
    ));
  };

  return <div className="space-y-0.5">{renderTree(fileTree)}</div>;
}
