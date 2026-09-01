'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import {
  RESPONSIBILITIES,
  Responsibility,
  getModelOptions,
} from '@/lib/ai/model-routing-schema';

interface ProfileData {
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  image: string | null;
  modelRouting?: Partial<Record<Responsibility, string>>;
}

interface KeysStatus {
  anthropic: boolean;
  gemini: boolean;
  openai: boolean;
  jules: boolean;
}

const RESPONSIBILITY_LABELS: Record<Responsibility, string> = {
  planner: 'Planner Agent Model',
  implementer: 'Implementer Agent Model',
  auditor: 'Auditor Agent Model',
  adjudicator: 'Adjudicator Agent Model',
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openai: 'OpenAI',
  jules: 'Jules',
};

export default function ProfileForm() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    modelRouting: {
      planner: '',
      implementer: '',
      auditor: '',
      adjudicator: '',
    } as Record<Responsibility, string>,
  });

  const modelOptions = getModelOptions();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, keysRes] = await Promise.all([
          fetch('/api/settings/profile'),
          fetch('/api/settings/keys-status'),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setData(profile);
          setFormData({
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            modelRouting: {
              planner: profile.modelRouting?.planner || '',
              implementer: profile.modelRouting?.implementer || '',
              auditor: profile.modelRouting?.auditor || '',
              adjudicator: profile.modelRouting?.adjudicator || '',
            },
          });
        }

        if (keysRes.ok) {
          const status = await keysRes.json();
          setKeysStatus(status);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.modelRouting) {
          setFormData((prev) => ({
            ...prev,
            modelRouting: {
              planner: result.modelRouting.planner || '',
              implementer: result.modelRouting.implementer || '',
              auditor: result.modelRouting.auditor || '',
              adjudicator: result.modelRouting.adjudicator || '',
            },
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center space-x-4 mb-6">
            {data?.image ? (
              <div className="h-16 w-16 rounded-full overflow-hidden border border-zinc-700">
                <Image src={data.image} alt="Avatar" width={64} height={64} />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold">
                {data?.name?.[0]?.toUpperCase() || data?.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-200">{data?.name || 'User'}</p>
              <p className="text-xs text-zinc-400">Profile image is managed via GitHub</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-400">Email Address</Label>
            <Input id="email" value={data?.email || ''} disabled className="bg-zinc-800/50 border-zinc-700 text-zinc-500" />
            <p className="text-xs text-zinc-500">Email cannot be changed.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-zinc-300">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-zinc-300">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Orchestrator Defaults</h3>
            <p className="text-sm text-zinc-400 mb-4">Select your preferred models for AI workflows. Overrides system defaults.</p>
            <div className="grid grid-cols-2 gap-4">
              {RESPONSIBILITIES.map((role) => {
                const selectedVal = formData.modelRouting[role] || '';
                const selectedOpt = modelOptions.find((o) => o.value === selectedVal);
                const isKeyMissing =
                  selectedOpt?.keySlot &&
                  keysStatus &&
                  keysStatus[selectedOpt.keySlot] === false;

                return (
                  <div key={role} className="space-y-2">
                    <Label htmlFor={`routing-${role}`} className="text-zinc-300">
                      {RESPONSIBILITY_LABELS[role]}
                    </Label>
                    <Select
                      value={selectedVal}
                      onChange={(val) =>
                        setFormData((prev) => ({
                          ...prev,
                          modelRouting: {
                            ...prev.modelRouting,
                            [role]: val,
                          },
                        }))
                      }
                      options={modelOptions}
                    />
                    {isKeyMissing && selectedOpt?.keySlot && (
                      <p className="text-xs text-amber-400 mt-1">
                        No {PROVIDER_NAMES[selectedOpt.keySlot] || selectedOpt.keySlot} key — add one in the API Keys tab
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
