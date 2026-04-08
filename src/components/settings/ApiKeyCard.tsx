'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiKeyCardProps {
  provider: 'gemini' | 'claude' | 'openai';
  label: string;
  isSystemDefault?: boolean;
}

export default function ApiKeyCard({ provider, label, isSystemDefault }: ApiKeyCardProps) {
  const [hasKey, setHasKey] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/settings/api-keys');
      if (res.ok) {
        const data = await res.json();
        const providerKey = `has${provider.charAt(0).toUpperCase() + provider.slice(1)}Key`;
        setHasKey(data[providerKey]);
        setIsDefault(data.preferredModel === provider);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!keyInput.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: keyInput.trim() }),
      });
      if (res.ok) {
        setHasKey(true);
        setKeyInput('');
        // When saved, it automatically becomes default
        setIsDefault(true);
        // Dispatch custom event so other cards can update their default status
        window.dispatchEvent(new Event('api-keys-updated'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setHasKey(false);
        setIsDefault(false);
        window.dispatchEvent(new Event('api-keys-updated'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    // If it's already default or doesn't have a key, do nothing
    if (isDefault || !hasKey) return;

    // We update preferred model by using PATCH profile
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredModel: provider }),
      });
      if (res.ok) {
        window.dispatchEvent(new Event('api-keys-updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const onKeysUpdated = () => fetchStatus();
    window.addEventListener('api-keys-updated', onKeysUpdated);
    return () => window.removeEventListener('api-keys-updated', onKeysUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className={cn('bg-zinc-900 border-zinc-800', isDefault && 'border-blue-500/50')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {label}
              {isDefault && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Default</Badge>}
            </CardTitle>
            {isSystemDefault && (
              <CardDescription className="text-xs mt-1">System default — used when no personal key is set</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasKey ? (
          <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-md">
            <code className="text-sm text-zinc-400">•••••••••••••••• Saved</code>
            <div className="flex items-center gap-2">
              {!isDefault && (
                <Button variant="outline" size="sm" onClick={handleSetDefault} className="h-8 border-zinc-700 hover:bg-zinc-800">
                  Set as Default
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting} className="h-8">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Input
              type="password"
              placeholder="Paste your API key..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
            />
            <Button onClick={handleSave} disabled={!keyInput.trim() || isSaving} className="shrink-0 bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Key'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
