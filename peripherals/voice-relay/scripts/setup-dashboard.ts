import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env from voice-relay
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASEURL = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
  console.error('Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY in .env');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64')}`,
};

async function setupDashboard() {
  console.log(`Setting up Voice Relay Dashboard on ${LANGFUSE_BASEURL}...`);

  const widgetsToCreate = [
    {
      name: 'Avg Latency (ms)',
      description: 'Average time to generate a response',
      view: 'scores-numeric',
      chartType: 'NUMBER',
      metrics: [{ measure: 'value', agg: 'avg' }],
      dimensions: [],
      filters: [{ type: 'string', column: 'name', operator: '=', value: 'latency_ms' }],
    },
    {
      name: 'Avg Tokens Used',
      description: 'Approximate words/tokens used per response',
      view: 'scores-numeric',
      chartType: 'NUMBER',
      metrics: [{ measure: 'value', agg: 'avg' }],
      dimensions: [],
      filters: [{ type: 'string', column: 'name', operator: '=', value: 'tokens_used' }],
    },
    {
      name: 'Conciseness Score',
      description: 'Score from 0.0 to 1.0 (1.0 = highly concise)',
      view: 'scores-numeric',
      chartType: 'NUMBER',
      metrics: [{ measure: 'value', agg: 'avg' }],
      dimensions: [],
      filters: [{ type: 'string', column: 'name', operator: '=', value: 'is_concise' }],
    }
  ];

  const createdWidgets = [];
  for (const widgetDef of widgetsToCreate) {
    const res = await fetch(`${LANGFUSE_BASEURL}/api/public/unstable/dashboard-widgets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(widgetDef),
    });

    if (!res.ok) {
      throw new Error(`Failed to create widget ${widgetDef.name}: ${await res.text()}`);
    }

    const widget = await res.json();
    console.log(`✓ Created widget: ${widget.name}`);
    createdWidgets.push(widget);
  }

  console.log('\nCreating Voice Relay Local Model Evals Dashboard...');
  const dashboardRes = await fetch(`${LANGFUSE_BASEURL}/api/public/unstable/dashboards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Voice Relay Local Model Evals',
    }),
  });

  if (!dashboardRes.ok) {
    throw new Error(`Failed to create dashboard: ${await dashboardRes.text()}`);
  }

  const dashboard = await dashboardRes.json();
  console.log(`✓ Created dashboard: ${dashboard.name} (ID: ${dashboard.id})`);

  const placements = [
    { type: 'widget', widgetId: createdWidgets[0].id },
    { type: 'widget', widgetId: createdWidgets[1].id },
    { type: 'widget', widgetId: createdWidgets[2].id },
  ];

  for (const [i, p] of placements.entries()) {
    const res = await fetch(`${LANGFUSE_BASEURL}/api/public/unstable/dashboards/${dashboard.id}/placements`, {
      method: 'POST',
      headers,
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      throw new Error(`Failed to place widget ${i}: ${await res.text()}`);
    }
  }

  console.log(`\n🎉 Dashboard created successfully!`);
  const projectId = dashboard.projectId;
  if (projectId) {
    console.log(`👉 View it at: ${LANGFUSE_BASEURL}/project/${projectId}/dashboards/${dashboard.id}`);
  } else {
    console.log(`👉 To view it, open Langfuse and click "Dashboards" in the left sidebar.`);
  }
}

setupDashboard().catch(console.error);
