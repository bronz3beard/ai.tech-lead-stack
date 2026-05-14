import { NextResponse } from 'next/server';
import { sendDiscordNotification } from '@/lib/notifications/discord-webhook';

export async function POST(req: Request) {
  try {
    const { featureId, branch, feedback, snapshotBase64 } = await req.json();

    if (!branch) {
      return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    let imageUrl = null;

    // 1. Project-Agnostic Persistence: Save snapshot to GitHub branch
    if (snapshotBase64) {
      // Remove data URI prefix
      const base64Data = snapshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `snapshot-${Date.now()}.png`;
      const githubPath = `.github/assets/feedback/${filename}`;

      console.log(`Uploading ${filename} directly to GitHub branch: ${branch} for feature: ${featureId}. Base64 size: ${base64Data.length} bytes...`);

      // TODO: GitHub API Call to upload blob and update tree
      // const blobRes = await githubApi.post('/git/blobs', { content: base64Data, encoding: 'base64' });
      // const treeRes = await githubApi.post('/git/trees', { base_tree, tree: [{ path: githubPath, mode: '100644', type: 'blob', sha: blobRes.sha }]});
      // const commitRes = await githubApi.post('/git/commits', { message: 'Add design feedback snapshot', tree: treeRes.sha, parents: [latestCommitSha] });
      // await githubApi.patch(`/git/refs/heads/${branch}`, { sha: commitRes.sha });

      // The raw URL format for GitHub (simulated)
      imageUrl = `https://raw.githubusercontent.com/OWNER/REPO/${branch}/${githubPath}`;
    }

    // 2. Draft PR Comment
    let commentBody = feedback || '';
    if (imageUrl) {
      commentBody += `\n\n### Visual Snapshot\n![Feedback Snapshot](${imageUrl})`;
    }

    console.log(`Posting comment to PR for branch ${branch}:`, commentBody);

    // TODO: GitHub API Call to post comment to the PR associated with the branch
    // await githubApi.post(`/issues/${prNumber}/comments`, { body: commentBody });

    // Send Discord Notification
    await sendDiscordNotification({
      content: `New Design Feedback on Feature Branch: \`${branch}\``,
      embeds: [
        {
          title: 'Feedback Details',
          description: feedback || 'Visual feedback attached.',
          color: 0x3b82f6,
          image: imageUrl ? { url: imageUrl } : undefined,
        }
      ]
    });

    return NextResponse.json({ success: true, message: 'Feedback posted' });
  } catch (error) {
    console.error('Failed to post feedback:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
