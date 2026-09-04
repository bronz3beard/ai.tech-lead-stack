import fs from 'fs/promises';
import path from 'path';
import { GraphData, SkillsBrowserClient } from './SkillsBrowserClient';

export default async function SkillsBrowserPage() {
  const filePath = path.join(process.cwd(), '../../.ai/skills.graph.json');
  let graphData: GraphData = { nodes: [], edges: [], artifactFlow: [] };

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    graphData = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load skills.graph.json', err);
  }

  return <SkillsBrowserClient graphData={graphData} />;
}
