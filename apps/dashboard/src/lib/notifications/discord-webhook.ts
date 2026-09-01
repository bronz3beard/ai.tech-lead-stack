export interface DiscordWebhookPayload {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    image?: { url: string };
    thumbnail?: { url: string };
    footer?: { text: string };
    timestamp?: string;
  }>;
}

export async function sendDiscordNotification(
  payload: DiscordWebhookPayload,
  customUrl?: string
): Promise<boolean> {
  const webhookUrl = customUrl || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      'DISCORD_WEBHOOK_URL is not configured. Skipping notification.'
    );
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        'Failed to send Discord notification:',
        await response.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    return false;
  }
}
