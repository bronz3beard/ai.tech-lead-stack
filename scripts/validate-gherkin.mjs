import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const IMPERATIVE_KEYWORDS = [
  'click',
  'type',
  'enter',
  'select',
  'wait',
  'see',
  'navigate',
];

export function validateGherkin(featureText) {
  const errors = [];
  const lines = featureText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let hasFeature = false;
  let hasScenario = false;
  let hasGivenWhenThen = false;

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith('feature:')) hasFeature = true;
    if (
      lowerLine.startsWith('scenario:') ||
      lowerLine.startsWith('scenario outline:')
    )
      hasScenario = true;
    if (
      lowerLine.startsWith('given ') ||
      lowerLine.startsWith('when ') ||
      lowerLine.startsWith('then ')
    ) {
      hasGivenWhenThen = true;
    }

    if (
      lowerLine.startsWith('given ') ||
      lowerLine.startsWith('when ') ||
      lowerLine.startsWith('then ') ||
      lowerLine.startsWith('and ') ||
      lowerLine.startsWith('but ')
    ) {
      const stepText = lowerLine.replace(/^(given|when|then|and|but)\s+/, '');
      for (const kw of IMPERATIVE_KEYWORDS) {
        const regex = new RegExp(`\\b${kw}\\b`);
        if (regex.test(stepText)) {
          errors.push(
            `Line ${index + 1}: Imperative keyword '${kw}' used in step. Use declarative business language instead.`
          );
        }
      }
    }
  });

  if (!hasFeature) errors.push('Missing "Feature:" declaration.');
  if (!hasScenario)
    errors.push('Missing "Scenario:" or "Scenario Outline:" declaration.');
  if (!hasGivenWhenThen) errors.push('Missing Given/When/Then steps.');

  return {
    valid: errors.length === 0,
    errors,
  };
}

function findFeatureFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFeatureFiles(filePath, fileList);
    } else if (filePath.endsWith('.feature')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let filesToScan = [];

  if (args.length > 0) {
    filesToScan = args.filter((f) => f.endsWith('.feature'));
  } else {
    filesToScan = findFeatureFiles(
      path.join(process.cwd(), '.ai/output/features')
    );
  }

  if (filesToScan.length === 0) {
    console.log('No .feature files found to validate.');
    process.exit(0);
  }

  let allValid = true;
  for (const file of filesToScan) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const { valid, errors } = validateGherkin(content);
      if (!valid) {
        console.error(`\x1b[31mInvalid Gherkin in ${file}:\x1b[0m`);
        errors.forEach((e) => console.error(`  - ${e}`));
        allValid = false;
      }
    } catch (err) {
      console.error(`Error reading ${file}: ${err.message}`);
      allValid = false;
    }
  }

  if (!allValid) {
    process.exit(1);
  } else {
    console.log('\x1b[32mAll Gherkin features are valid.\x1b[0m');
    process.exit(0);
  }
}
