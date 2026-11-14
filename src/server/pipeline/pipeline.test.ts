import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt } from './prompt-analyzer.ts';
import { extractJsonObject, runHaikuUiArchitect } from './haiku-architect.ts';
import { computeFileDiffLines, parseGeneratedFiles, runDeepSeekEngineer } from './deepseek-engineer.ts';
import { compilePreviewWithEsbuild } from './esbuild-preview.ts';
import { createZipArchive } from './zip-exporter.ts';

test('analyzePrompt classifies domain, dark mode, brand, and intent', () => {
  const createRes = analyzePrompt('Landing page for "Kopi Malam" specialty coffee shop with dark mode', []);
  assert.equal(createRes.intent, 'create');
  assert.equal(createRes.domain, 'coffee-hospitality');
  assert.equal(createRes.brandName, 'Kopi Malam');
  assert.equal(createRes.darkMode, true);

  const reviseRes = analyzePrompt('Make the footer dark zinc', [
    { path: 'src/App.tsx', content: 'export default function App() { return <div />; }', version: 1 },
  ]);
  assert.equal(reviseRes.intent, 'revise');
  assert.equal(reviseRes.relevantFiles[0]?.path, 'src/App.tsx');
});

test('extractJsonObject parses fenced JSON blocks reliably', () => {
  const parsed = extractJsonObject('```json\n{"brandName":"Test","ok":true}\n```') as { brandName: string };
  assert.equal(parsed.brandName, 'Test');
});

test('parseGeneratedFiles extracts XML <file> blocks and computes diffs', () => {
  const raw = `<file path="src/App.tsx">
export default function App() {
  return <div>Hello</div>;
}
</file>
<file path="src/components/Hero.tsx">
export function Hero() { return <section>Hero</section>; }
</file>`;
  const files = parseGeneratedFiles(raw);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'src/App.tsx');
  assert.equal(files[1].path, 'src/components/Hero.tsx');

  const diffs = computeFileDiffLines('const a = 1;\nconst b = 2;', 'const a = 1;\nconst b = 3;');
  assert.ok(diffs.some((d) => d.type === 'remove' && d.text.includes('const b = 2')));
  assert.ok(diffs.some((d) => d.type === 'add' && d.text.includes('const b = 3')));
});

test('full 3-stage pipeline (Prompt -> Haiku Architect -> DeepSeek Synthesizer -> esbuild + ZIP)', async () => {
  const prompt = 'SaaS pricing page for "MetricFlow" with 3 tiers';
  const analysis = analyzePrompt(prompt, []);
  const blueprint = await runHaikuUiArchitect(prompt, analysis);
  assert.equal(blueprint.brandName, 'MetricFlow');
  assert.ok(blueprint.sections.length >= 2);

  const synthesis = await runDeepSeekEngineer(prompt, analysis, blueprint, []);
  assert.ok(synthesis.files.some((f) => f.path === 'src/App.tsx'));
  assert.ok(synthesis.files.some((f) => f.path === 'src/components/Navbar.tsx'));

  const preview = await compilePreviewWithEsbuild(synthesis.files, blueprint.brandName);
  assert.equal(preview.error, null);
  assert.ok(preview.html && preview.html.includes('MetricFlow'));
  assert.ok(preview.bundledBytes > 1000);

  const zip = createZipArchive(synthesis.files);
  // PKZIP magic header: 0x50 0x4B 0x03 0x04
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
});
