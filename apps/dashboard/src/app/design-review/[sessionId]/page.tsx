import { DesignReviewSession } from '@/components/design-review/DesignReviewSession';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Design Review Session — Tech Lead Stack',
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * @desc Server component shell for /design-review/[sessionId].
 * Validates auth and delegates the interactive split-panel layout to
 * DesignReviewSession (client component).
 */
export default async function DesignReviewSessionPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/signin');
  }

  const { sessionId } = await params;

  return <DesignReviewSession sessionId={sessionId} />;
}
