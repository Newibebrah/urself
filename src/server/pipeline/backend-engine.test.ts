import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt } from './prompt-analyzer.ts';
import {
  TEMPLATE_CONTRACTS,
  selectBlueprintPhase1,
  validateAgainstContract,
} from './template-contracts.ts';
import { formatPatternsForSystemPrompt, retrieveRelevantPatterns } from './pattern-rag.ts';
import { StreamingJsonFileParser, parsePartialGeneratedPayload } from './streaming-json-parser.ts';
import { runSelfHealingLoop, validateAstAndCompile } from './self-healing.ts';
import type { ProjectFile } from '../../features/projects/types.ts';

test('Phase 1 selector picks rigid TemplateContract and Zod schema rejects disallowed packages or missing entry', async () => {
  const loginPrompt = 'Buat form login modern dengan split screen dan validasi email';
  const loginAnalysis = analyzePrompt(loginPrompt, []);
  const phase1 = await selectBlueprintPhase1(loginPrompt, loginAnalysis, []);
  assert.equal(phase1.templateId, 'auth-login');
  assert.ok(phase1.contract.allowedFiles.includes('src/App.tsx'));

  const badPackageFiles: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import axios from 'axios';
export default function App() { return <div>{String(Boolean(axios))}</div>; }`,
    },
  ];
  const badCheck = validateAgainstContract(badPackageFiles, TEMPLATE_CONTRACTS['auth-login']);
  assert.equal(badCheck.valid, false);
  assert.ok(badCheck.disallowedPackages.includes('axios'));

  const validFiles: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import React from 'react';
import { Shield } from 'lucide-react';
export default function App() { return <main><Shield />Sign in</main>; }`,
    },
  ];
  const goodCheck = validateAgainstContract(validFiles, TEMPLATE_CONTRACTS['auth-login']);
  assert.equal(goodCheck.valid, true);
});

test('Pattern RAG retrieves matching UI component snippets via cosine vector similarity', () => {
  const navbarMatches = retrieveRelevantPatterns('Buatkan sticky navbar dengan blur effect', 'landing-page', 2);
  assert.equal(navbarMatches.length, 2);
  assert.equal(navbarMatches[0].id, 'sticky-blur-navbar');

  const dashMatches = retrieveRelevantPatterns('KPI analytics dashboard with invoice table', 'dashboard', 2);
  assert.equal(dashMatches[0].id, 'kpi-analytics-table');

  const promptBlock = formatPatternsForSystemPrompt(navbarMatches);
  assert.ok(promptBlock.includes('backdrop-blur-lg'));
  assert.ok(promptBlock.includes('Sticky Glassmorphic Navbar'));
});

test('StreamingJsonFileParser emits completed files incrementally before JSON payload finishes streaming', () => {
  const parser = new StreamingJsonFileParser();

  const chunks = [
    '```json\n{\n  "files": [\n    {\n      "path": "src/components/Navbar.tsx",\n',
    '      "content": "import React from \'react\';\\nexport function Navbar() { return <nav>\\"Brand\\"</nav>; }"\n    },\n',
    '    {\n      "path": "src/App.tsx",\n      "content": "import React from \'react\';\\nexport default function App() { ',
    'return <main>Hello</main>; }"\n    }\n  ],\n  "summary": "Streamed modular React app"\n}\n```',
  ];

  // After chunk 1 + chunk 2, Navbar.tsx object has closed even though App.tsx and closing brace are not streamed yet!
  assert.equal(parser.feed(chunks[0]).length, 0);
  const afterFile1 = parser.feed(chunks[1]);
  assert.equal(afterFile1.length, 1);
  assert.equal(afterFile1[0].path, 'src/components/Navbar.tsx');
  assert.ok(afterFile1[0].content.includes('"Brand"'));
  assert.equal(parser.getSnapshot().isComplete, false);

  // Partial App.tsx in chunk 3 should not emit until closing brace in chunk 4
  assert.equal(parser.feed(chunks[2]).length, 0);
  const afterFile2 = parser.feed(chunks[3]);
  assert.equal(afterFile2.length, 1);
  assert.equal(afterFile2[0].path, 'src/App.tsx');

  const snap = parser.getSnapshot();
  assert.equal(snap.isComplete, true);
  assert.equal(snap.summary, 'Streamed modular React app');
});

test('parsePartialGeneratedPayload falls back cleanly to XML <file> blocks', () => {
  const xmlSnap = parsePartialGeneratedPayload(
    `<file path="src/App.tsx">\nexport default function App() { return <div />; }\n</file>\n<summary>Done</summary>`
  );
  assert.equal(xmlSnap.files.length, 1);
  assert.equal(xmlSnap.summary, 'Done');
  assert.equal(xmlSnap.isComplete, true);
});

test('Self-Healing loop detects AST/compiler syntax errors and heals via LLM repair callback & deterministic fallback', async () => {
  const brokenFiles: ProjectFile[] = [
    {
      path: 'src/App.tsx',
      version: 1,
      content: `import React from 'react';
import { MissingWidget } from './components/MissingWidget';
function App() {
  return <main><MissingWidget /></main>;
}`,
    },
  ];

  const diag = await validateAstAndCompile(brokenFiles, TEMPLATE_CONTRACTS['landing-page']);
  assert.equal(diag.ok, false);
  assert.ok(diag.errorSummary.includes('MissingWidget') || diag.errorSummary.includes('export default'));

  // Case A: LLM callback repairs the file on attempt 1
  let capturedErrorLog = '';
  const llmHealed = await runSelfHealingLoop({
    prompt: 'Build a landing page',
    initialFiles: brokenFiles,
    contract: TEMPLATE_CONTRACTS['landing-page'],
    maxAttempts: 3,
    repairWithLlm: async ({ errorSummary }) => {
      capturedErrorLog = errorSummary;
      return [
        {
          path: 'src/App.tsx',
          version: 2,
          content: `import React from 'react';
export default function App() {
  return <main><h1>Healed by DeepSeek</h1></main>;
}`,
        },
      ];
    },
  });

  assert.equal(llmHealed.healed, true);
  assert.equal(llmHealed.attempts, 1);
  assert.ok(capturedErrorLog.length > 0);
  assert.ok(llmHealed.previewHtml && llmHealed.previewHtml.includes('<!doctype html>'));

  // Case B: No LLM callback -> deterministic AST repair removes missing import and adds export default
  const detHealed = await runSelfHealingLoop({
    prompt: 'Build a landing page',
    initialFiles: [
      {
        path: 'src/App.tsx',
        version: 1,
        content: `import React from 'react';
import { GhostCard } from './components/GhostCard';
function App() {
  return <main><h1>Recovered</h1></main>;
}`,
      },
    ],
    contract: TEMPLATE_CONTRACTS['landing-page'],
    maxAttempts: 2,
  });

  assert.equal(detHealed.healed, true);
  assert.equal(detHealed.attempts, 1);
  assert.ok(detHealed.files[0].content.includes('export default function App'));
});
