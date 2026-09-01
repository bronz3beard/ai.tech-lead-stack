'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import ApiKeyCard from './ApiKeyCard';
import ConfigGuide from './ConfigGuide';
import ProfileForm from './ProfileForm';
import ProjectIntegrationsPanel from './ProjectIntegrationsPanel';
import ProjectModelRouting from './ProjectModelRouting';
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
        <TabsList className="grid w-full grid-cols-5 max-w-[680px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="projects">Project Access</TabsTrigger>
          {(role === 'DEVELOPER' || role === 'ADMIN') && (
            <>
              <TabsTrigger value="model-routing">Project Models</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </>
          )}
          <TabsTrigger
            value="setup"
            className="mt-2.5 border-gray-50 cursor-pointer"
          >
            Setup Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-8">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-10 space-y-6">
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

          <hr className="border-zinc-800 my-8" />
          
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-lg font-medium text-zinc-100">Infrastructure Keys</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage API keys for execution environments and sandboxes. These are strictly used for infrastructure and do not have a default model functionality.
              </p>
            </div>
            
            <ApiKeyCard 
              provider="e2b" 
              label="Sandbox Environment API key" 
              canBeDefault={false} 
            />
            <p className="text-xs text-muted-foreground pl-1 mt-2">
              Provides a secure cloud sandbox for the AI agents to execute code and terminal commands. Learn more at <a href="https://e2b.dev" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">e2b.dev</a>.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-10">
          {role === 'DEVELOPER' || role === 'ADMIN' ? (
            <ProjectSharingPanel initialProjects={projects} />
          ) : (
            <SharedProjectsReadOnly />
          )}
        </TabsContent>

        {(role === 'DEVELOPER' || role === 'ADMIN') && (
          <>
            <TabsContent value="model-routing" className="mt-10">
              <ProjectModelRouting />
            </TabsContent>
            <TabsContent value="integrations" className="mt-10">
              <ProjectIntegrationsPanel />
            </TabsContent>
          </>
        )}
        <TabsContent value="setup" className="mt-8">
          <ConfigGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}
