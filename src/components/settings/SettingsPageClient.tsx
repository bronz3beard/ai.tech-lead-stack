'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import ApiKeyCard from './ApiKeyCard';
import ConfigGuide from './ConfigGuide';
import ProfileForm from './ProfileForm';
import ProjectIntegrationsPanel from './ProjectIntegrationsPanel';
import ProjectSharingPanel, { UIProjectAccess } from './ProjectSharingPanel';
import SharedProjectsReadOnly from './SharedProjectsReadOnly';

interface SettingsPageClientProps {
  role: string;
  projects: Array<UIProjectAccess>;
}

export default function SettingsPageClient({
  role,
  projects,
}: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[540px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="projects">Project Access</TabsTrigger>
          {(role === 'DEVELOPER' || role === 'ADMIN') && (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          )}
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground mb-4">
            Manage your API keys for different AI models. For Gemini, a key
            saved here takes priority over GEMINI_API_KEY /
            GOOGLE_GENERATIVE_AI_API_KEY in the server environment unless you
            set GEMINI_API_KEY_PRECEDENCE=env. Google&apos;s
            &quot;free_tier_requests&quot; quota errors still mean your key is
            being used; enable billing on that Google AI project for higher
            limits.
          </p>
          <ApiKeyCard
            provider="gemini"
            label="Gemini (Google)"
            isSystemDefault
          />
          <ApiKeyCard provider="jules" label="Google Jules (Agentic)" />
          <ApiKeyCard provider="claude" label="Claude (Anthropic)" />
          <ApiKeyCard provider="openai" label="ChatGPT (OpenAI)" />
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          {role === 'DEVELOPER' || role === 'ADMIN' ? (
            <ProjectSharingPanel initialProjects={projects} />
          ) : (
            <SharedProjectsReadOnly />
          )}
        </TabsContent>

        {(role === 'DEVELOPER' || role === 'ADMIN') && (
          <TabsContent value="integrations" className="mt-6">
            <ProjectIntegrationsPanel />
          </TabsContent>
        )}
        <TabsContent value="setup" className="mt-6">
          <ConfigGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}
