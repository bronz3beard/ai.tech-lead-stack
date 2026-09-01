'use server';

// ai-actions is intentionally kept light since most streaming functionality
// relies on the /api/skills/chat route handler which works better with the AI SDK useChat hook.
// This file serves as the definition layer if server-actions are needed elsewhere.
export async function generateSkillFeedback() {
  throw new Error("Use /api/skills/chat API route for streaming UI interaction.");
}
