'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ProfileData {
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  image: string | null;
}

export default function ProfileForm() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const profile = await res.json();
          setData(profile);
          setFormData({
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
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
        // success state handling could be added
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

          <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
