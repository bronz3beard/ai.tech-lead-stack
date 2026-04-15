import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedProvider = localStorage.getItem('ai_provider') as any;
      if (savedProvider) setProvider(savedProvider);
      const savedKey = localStorage.getItem(`ai_key_${savedProvider || 'openai'}`);
      if (savedKey) setApiKey(savedKey);
      else setApiKey('');
    }
  }, [isOpen]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as any;
    setProvider(newProvider);
    const savedKey = localStorage.getItem(`ai_key_${newProvider}`);
    setApiKey(savedKey || '');
  };

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem(`ai_key_${provider}`, apiKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card w-full max-w-md rounded-lg shadow-lg border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google (Gemini)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${provider} API key`}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Keys are stored securely in your browser's local storage.
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-md text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
