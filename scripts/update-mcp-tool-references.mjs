import fs from 'fs';
import path from 'path';

const dirs = [
  '.agents/workflows',
  '.agents/pm-workflows',
  '.ai/skills',
  '.ai/pm-skills',
];

const singleFiles = ['.ai/agents.md'];

// Naming guide for prefixed tools
const NOTES = {
  get_skills:
    '(which may be named mcp_tech-lead-stack_get_skills, tech-lead-stack_get_skills, or get_skills depending on client prefixing)',
  get_skill:
    '(which may be named mcp_tech-lead-stack_get_skill, tech-lead-stack_get_skill, or get_skill depending on client prefixing)',
  verify_mission_alignment:
    '(which may be named mcp_tech-lead-stack_verify_mission_alignment, tech-lead-stack_verify_mission_alignment, or verify_mission_alignment depending on client prefixing)',
  list_skills:
    '(which may be named mcp_tech-lead-stack_list_skills, tech-lead-stack_list_skills, or list_skills depending on client prefixing)',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replacements list
  const replacements = [
    // get_skills tool references
    {
      search: /Call the `get_skills` tool:/g,
      replace: `Call the \`get_skills\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` or \`tech-lead-stack_get_skills\` depending on client prefixing):`,
    },
    {
      search: /You MUST call the MCP `get_skills` tool/g,
      replace: `You MUST call the MCP \`get_skills\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` or \`tech-lead-stack_get_skills\` depending on client prefixing)`,
    },
    {
      search: /You MUST call the internal `get_skill` tool/g,
      replace: `You MUST call the internal \`get_skill\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skill\` or \`tech-lead-stack_get_skill\` depending on client prefixing)`,
    },
    {
      search: /Call the `get_skills` \/ `get_skill` tool/g,
      replace: `Call the \`get_skills\` \/ \`get_skill\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` \/ \`mcp_tech-lead-stack_get_skill\` or \`tech-lead-stack_get_skills\` \/ \`tech-lead-stack_get_skill\` depending on client prefixing)`,
    },
    {
      search: /Call `get_skills` or `get_skill` MCP tools/g,
      replace: `Call \`get_skills\` or \`get_skill\` MCP tools (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` \/ \`mcp_tech-lead-stack_get_skill\` or \`tech-lead-stack_get_skills\` \/ \`tech-lead-stack_get_skill\` depending on client prefixing)`,
    },
    {
      search: /Call `get_skills`\./g,
      replace: `Call \`get_skills\` (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` or \`tech-lead-stack_get_skills\` depending on client prefixing).`,
    },
    {
      search: /use the MCP `get_skills` tool\./g,
      replace: `use the MCP \`get_skills\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skills\` or \`tech-lead-stack_get_skills\` depending on client prefixing).`,
    },
    {
      search: /use the internal `get_skill` tool\./g,
      replace: `use the internal \`get_skill\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skill\` or \`tech-lead-stack_get_skill\` depending on client prefixing).`,
    },
    // PM workflows:
    {
      search:
        /\*\*MANDATORY: You MUST call get_skill\(skillName: "pm-([^"]+)", \.\.\.\) before proceeding\.\*\*/g,
      replace: `**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**`,
    },
    {
      search: /Call the `get_skill` tool:\s*\n\s*- skillName: "pm-([^"]+)"/g,
      replace: `Call the \`get_skill\` tool (which may be prefixed as \`mcp_tech-lead-stack_get_skill\` or \`tech-lead-stack_get_skill\` depending on client prefixing):\n   - skillName: "pm-$1"`,
    },
    // verify_mission_alignment
    {
      search: /You MUST call `verify_mission_alignment` before performing/g,
      replace: `You MUST call \`verify_mission_alignment\` (which may be prefixed as \`mcp_tech-lead-stack_verify_mission_alignment\` or \`tech-lead-stack_verify_mission_alignment\` depending on client prefixing) before performing`,
    },
    {
      search: /called the `verify_mission_alignment` MCP tool/g,
      replace: `called the \`verify_mission_alignment\` MCP tool (which may be prefixed as \`mcp_tech-lead-stack_verify_mission_alignment\` or \`tech-lead-stack_verify_mission_alignment\` depending on client prefixing)`,
    },
    {
      search: /\[\[verify-mission-alignment\]\]/g,
      replace: `[[verify-mission-alignment]] (exposed as \`verify_mission_alignment\` / \`mcp_tech-lead-stack_verify_mission_alignment\` / \`tech-lead-stack_verify_mission_alignment\`)`,
    },
  ];

  // Apply each replacement only if not already containing the prefix note to prevent double-replacement
  for (const rep of replacements) {
    // Basic check: if the replacement string's prefix note is already in the file next to the search term, skip it.
    // Or we can just do a replace, but to be safe and avoid double-matching, we can check if it's already there.
    content = content.replace(rep.search, (match) => {
      // If the content already has "mcp_tech-lead-stack" in that region, don't replace
      return content.includes('mcp_tech-lead-stack') ? match : rep.replace;
    });
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
    return true;
  }
  return false;
}

let updatedCount = 0;
const root = process.cwd();

// Process directories recursively
for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found: ${dirPath}`);
    continue;
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(dirPath, file);
      if (processFile(filePath)) {
        updatedCount++;
      }
    }
  }
}

// Process individual files
for (const file of singleFiles) {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    if (processFile(filePath)) {
      updatedCount++;
    }
  }
}

console.log(`Done! Total files updated: ${updatedCount}`);
