import { authOptions } from '@/lib/auth';
import { createGitHubClient } from '@/lib/github/client';
import { sendDiscordNotification } from '@/lib/notifications/discord-webhook';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { branch, feedback, snapshotBase64, projectId } = await req.json();

    if (!branch || !projectId) {
      return NextResponse.json({ error: 'Branch and Project ID are required' }, { status: 400 });
    }

    const client = await createGitHubClient(session.user.id, projectId);
    let imageUrl = null;

    // 1. Project-Agnostic Persistence: Save snapshot to GitHub branch
    if (snapshotBase64) {
      const base64Data = snapshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `snapshot-${Date.now()}.png`;
      const githubPath = `.github/assets/feedback/${filename}`;

      console.log(`Uploading ${filename} directly to GitHub branch: ${branch} for project: ${projectId}`);

      await client.commitFiles(branch, 'Add design feedback snapshot', {
        [githubPath]: { content: base64Data, encoding: 'base64' }
      });

      imageUrl = `https://raw.githubusercontent.com/${client.owner}/${client.repo}/${branch}/${githubPath}`;
    }

    // 2. Draft PR Comment
    let commentBody = feedback || '';
    if (imageUrl) {
      commentBody += `\n\n### Visual Snapshot\n![Feedback Snapshot](${imageUrl})`;
    }

    // 3. Post comment to the PR associated with the branch
    const pr = await client.findPRForBranch(branch);
    if (pr) {
      console.log(`Posting comment to PR #${pr.number} for branch ${branch}`);
      await client.postPRComment(pr.number, commentBody);
    } else {
      console.warn(`No active PR found for branch ${branch}. Discord notification will still be sent.`);
    }

    // Send Discord Notification
    await sendDiscordNotification({
      content: `New Design Feedback on Feature Branch: \`${branch}\``,
      embeds: [
        {
          title: 'Feedback Details',
          description: feedback || 'Visual feedback attached.',
          color: 0x3b82f6,
          image: imageUrl ? { url: imageUrl } : undefined,
          url: pr ? pr.html_url : undefined
        }
      ]
    });

    return NextResponse.json({ 
      success: true, 
      message: pr ? 'Feedback posted to PR' : 'Feedback recorded (no PR found)' 
    });
  } catch (error: any) {
    console.error('Failed to post feedback:', error);

    if (error.message.includes('SECURITY VIOLATION')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
