import SettingsPageClient from '@/components/settings/SettingsPageClient';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getSettingsProjects } from './actions';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const transformedProjects = await getSettingsProjects();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Settings</h1>
      <SettingsPageClient
        role={session.user.role}
        projects={transformedProjects}
      />
    </div>
  );
}
