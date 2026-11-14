import fs from 'node:fs';
import path from 'node:path';
import { MOCK_BUILDER_CONVERSATIONS, getConversationForProject } from '../../features/generation/mock.ts';
import { MOCK_PROJECTS } from '../../features/projects/mock.ts';
import type {
  CreateProjectInput,
  Project,
  ProjectFile,
  ProjectPromptState,
  ProjectRevision,
  ProjectWithFiles,
  RevisionSource,
} from '../../features/projects/types.ts';
import type { BuilderMessage } from '../../types/index.ts';
import { analyzePrompt } from '../pipeline/prompt-analyzer.ts';

export interface StoredWorkspace {
  project: Project;
  files: ProjectFile[];
  messages: BuilderMessage[];
  revisions: ProjectRevision[];
  promptState: ProjectPromptState;
}

export interface RevisionSnapshotMeta {
  label?: string;
  summary: string;
  source: RevisionSource;
  agent?: ProjectPromptState['activeAgent'];
  prompt?: string | null;
}

export interface WorkspaceUpdatePatch {
  status?: Project['status'];
  name?: string;
  thumbnailColor?: string;
  files?: ProjectFile[];
  appendMessages?: BuilderMessage[];
  replaceMessages?: BuilderMessage[];
  promptState?: Partial<ProjectPromptState>;
  revisionMeta?: RevisionSnapshotMeta;
}

const ACTIVE_STREAM_PHASES = new Set<ProjectPromptState['phase']>([
  'analyzing',
  'haiku_ui',
  'deepseek_code',
  'esbuild_preview',
]);

function createDefaultPromptState(
  project: Project,
  initialPrompt?: string
): ProjectPromptState {
  const now = project.updatedAt || new Date().toISOString();
  if (initialPrompt && initialPrompt.trim().length > 0) {
    return {
      phase: 'queued',
      activePrompt: initialPrompt.trim(),
      activeAgent: 'agent-manager',
      strategy: null,
      lastComplexity: null,
      lastError: null,
      revisionCount: 0,
      updatedAt: now,
    };
  }

  return {
    phase:
      project.status === 'ready'
        ? 'completed'
        : project.status === 'generating'
        ? 'deepseek_code'
        : project.status === 'failed'
        ? 'failed'
        : 'idle',
    activePrompt:
      project.status === 'generating'
        ? 'Building workspace components...'
        : null,
    activeAgent: project.status === 'generating' ? 'deepseek' : null,
    strategy:
      project.status === 'ready' || project.status === 'generating'
        ? 'hybrid-dual'
        : null,
    lastComplexity: null,
    lastError:
      project.status === 'failed'
        ? 'Previous build failed. Reset state or send a new prompt to retry.'
        : null,
    revisionCount: project.status === 'ready' ? 1 : 0,
    updatedAt: now,
  };
}

function buildSeedFilesForProject(project: Project): ProjectFile[] {
  const safeName = JSON.stringify(project.name);
  const accent = project.thumbnailColor ?? '#059669';
  const draftSubtitle = project.initialPrompt
    ? `Initialized from prompt: ${project.initialPrompt.slice(0, 140)}`
    : 'Draft workspace ready. Send a prompt in the chat panel to generate components.';

  if (project.status === 'draft') {
    return [
      {
        path: 'src/App.tsx',
        version: 1,
        content: `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500">
          UI
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">${project.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          ${draftSubtitle.replace(/[`$]/g, '')}
        </p>
      </div>
    </main>
  );
}
`,
      },
      {
        path: 'package.json',
        version: 1,
        content: JSON.stringify(
          { name: project.id, private: true, scripts: { dev: 'vite', build: 'vite build' } },
          null,
          2
        ),
      },
    ];
  }

  return [
    {
      path: 'src/App.tsx',
      version: 3,
      content: `import React, { useState } from 'react';

const HIGHLIGHTS = [
  { label: '01', title: 'Single-Origin Roasts', body: 'Small-batch Arabica from Aceh Gayo, Flores Bajawa, and Toraja.' },
  { label: '02', title: 'Daily Brew Bar', body: 'Pour-over, espresso, and cold brew served 07:00 – 21:00 WIB.' },
  { label: '03', title: 'Direct Farm Trade', body: 'Transparent harvest pricing with West Java and Sumatra growers.' },
];

export default function App() {
  const [ordered, setOrdered] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-sm font-bold tracking-tight">${project.name}</span>
          <nav className="flex items-center gap-5 text-xs text-slate-500">
            <a href="#highlights" className="hover:text-slate-900">Highlights</a>
            <a href="#hours" className="hover:text-slate-900">Hours</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <p style={{ color: ${JSON.stringify(accent)} }} className="text-xs font-medium uppercase tracking-widest">
          Live Build Preview
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
          ${project.name}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
          Compiled in-memory with esbuild. Ask AI in the middle panel to adjust layout, add sections, or change visual tokens.
        </p>

        <div className="mt-7 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOrdered(true)}
            style={{ backgroundColor: ${JSON.stringify(accent)} }}
            className="inline-flex h-9 items-center rounded-lg px-4 text-xs font-medium text-white"
          >
            {ordered ? 'Order Queued' : 'Order Beans'}
          </button>
          <a
            href="#highlights"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700"
          >
            View Catalog
          </a>
        </div>

        <section id="highlights" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-mono text-xs text-slate-400">{item.label}</div>
              <h2 className="mt-2 text-sm font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer id="hours" className="border-t border-slate-200 bg-white px-6 py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span>${project.name}</span>
          <span>Generated by urself.online</span>
        </div>
      </footer>
    </div>
  );
}
`,
    },
    {
      path: 'package.json',
      version: 1,
      content: JSON.stringify(
        {
          name: JSON.parse(safeName).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          private: true,
          scripts: { dev: 'vite', build: 'vite build' },
        },
        null,
        2
      ),
    },
  ];
}

function createBaselineRevision(
  files: ProjectFile[],
  project: Project
): ProjectRevision {
  const createdAt = project.updatedAt || new Date().toISOString();
  return {
    id: `rev_1_${project.id}`,
    version: 1,
    label: project.status === 'ready' ? 'Initial live build' : 'Initial workspace',
    summary: `Baseline snapshot (${files.length} files)`,
    source: 'seed',
    agent: null,
    prompt: project.initialPrompt ?? null,
    createdAt,
    files: files.map((f) => ({ ...f })),
  };
}

function createNextRevisionRecord(
  revisions: ProjectRevision[],
  files: ProjectFile[],
  meta: RevisionSnapshotMeta
): ProjectRevision {
  const maxVer = revisions.reduce((m, r) => Math.max(m, r.version), 0);
  const nextVer = maxVer + 1;
  const fallbackLabel =
    meta.source === 'ai-generation'
      ? `AI Build v${nextVer}`
      : meta.source === 'rollback'
      ? `Rollback v${nextVer}`
      : meta.source === 'manual'
      ? `Manual Edit v${nextVer}`
      : `Snapshot v${nextVer}`;

  return {
    id: `rev_${nextVer}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    version: nextVer,
    label: meta.label?.trim() || fallbackLabel,
    summary: meta.summary,
    source: meta.source,
    agent: meta.agent ?? null,
    prompt: meta.prompt ?? null,
    createdAt: new Date().toISOString(),
    files: files.map((f) => ({ ...f })),
  };
}

function normalizeProjectSummary(ws: StoredWorkspace): Project {
  return {
    ...ws.project,
    fileCount: ws.files.length,
    messageCount: ws.messages.length,
    revisionCount: ws.revisions.length,
    promptState: { ...ws.promptState },
  };
}

function normalizeFiles(files: ProjectFile[]): ProjectFile[] {
  const map = new Map<string, ProjectFile>();
  for (const file of files) {
    const cleanPath = file.path.trim().replace(/^\/+/, '');
    if (!cleanPath) continue;
    map.set(cleanPath, {
      path: cleanPath,
      content: file.content,
      version: Math.max(1, Number(file.version) || 1),
    });
  }
  return Array.from(map.values());
}

export class ProjectStore {
  private workspaces = new Map<string, StoredWorkspace>();
  private readonly storageFilePath: string | null;

  constructor(storageFilePath: string | null = path.resolve(process.cwd(), '.data', 'workspaces.json')) {
    this.storageFilePath = storageFilePath;
    this.hydrate();
  }

  private hydrate(): void {
    if (this.storageFilePath && fs.existsSync(this.storageFilePath)) {
      try {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as StoredWorkspace[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          let recovered = false;
          for (const ws of parsed) {
            if (!ws?.project?.id) continue;
            const promptState: ProjectPromptState =
              ws.promptState ?? createDefaultPromptState(ws.project, ws.project.initialPrompt);

            // Recover interrupted live streams cleanly after a server restart
            if (ACTIVE_STREAM_PHASES.has(promptState.phase)) {
              recovered = true;
              promptState.phase = 'failed';
              promptState.lastError =
                'Generation stream interrupted by server restart. Reset or resend prompt to continue.';
              promptState.updatedAt = new Date().toISOString();
              if (ws.project.status === 'generating') {
                ws.project.status = 'failed';
              }
            }

            const files = Array.isArray(ws.files) ? ws.files : [];
            const revisions =
              Array.isArray(ws.revisions) && ws.revisions.length > 0
                ? ws.revisions
                : [createBaselineRevision(files, ws.project)];

            this.workspaces.set(ws.project.id, {
              project: { ...ws.project },
              files,
              messages: Array.isArray(ws.messages) ? ws.messages : [],
              revisions,
              promptState,
            });
          }
          if (recovered) {
            this.persist();
          }
          return;
        }
      } catch {
        // Corrupt or unreadable storage falls back cleanly to seed workspaces
      }
    }

    this.seedDefaults();
    this.persist();
  }

  private seedDefaults(): void {
    this.workspaces.clear();
    for (const proj of MOCK_PROJECTS) {
      const files = buildSeedFilesForProject(proj);
      const messages = MOCK_BUILDER_CONVERSATIONS[proj.id]
        ? [...MOCK_BUILDER_CONVERSATIONS[proj.id]]
        : getConversationForProject(proj.id, proj.name);
      this.workspaces.set(proj.id, {
        project: { ...proj },
        files,
        messages,
        revisions: [createBaselineRevision(files, proj)],
        promptState: createDefaultPromptState(proj),
      });
    }
  }

  private persist(): void {
    if (!this.storageFilePath) return;
    try {
      const dir = path.dirname(this.storageFilePath);
      fs.mkdirSync(dir, { recursive: true });
      const tempPath = `${this.storageFilePath}.tmp`;
      const payload = JSON.stringify(Array.from(this.workspaces.values()), null, 2);
      fs.writeFileSync(tempPath, payload, 'utf-8');
      fs.renameSync(tempPath, this.storageFilePath);
    } catch {
      // Non-fatal in read-only sandboxes
    }
  }

  listProjects(): Project[] {
    return Array.from(this.workspaces.values())
      .map(normalizeProjectSummary)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getWorkspace(id: string): StoredWorkspace | null {
    return this.workspaces.get(id) ?? null;
  }

  getProjectWithFiles(
    id: string
  ): (ProjectWithFiles & {
    messages: BuilderMessage[];
    revisions: ProjectRevision[];
    promptState: ProjectPromptState;
  }) | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;
    return {
      ...normalizeProjectSummary(ws),
      files: ws.files.map((f) => ({ ...f })),
      messages: ws.messages.map((m) => ({ ...m })),
      revisions: ws.revisions.map((r) => ({ ...r, files: r.files.map((f) => ({ ...f })) })),
      promptState: { ...ws.promptState },
    };
  }

  createProject(input: string | CreateProjectInput): StoredWorkspace {
    const normalized: CreateProjectInput =
      typeof input === 'string' ? { name: input } : input ?? {};

    const initialPrompt = normalized.initialPrompt?.trim();
    const rawName = normalized.name?.trim();
    const derivedName = initialPrompt
      ? analyzePrompt(initialPrompt, []).brandName
      : 'Untitled Website';

    const finalName = (rawName && rawName.length > 0 ? rawName : derivedName).slice(0, 64);
    const id = `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const nowIso = new Date().toISOString();

    const project: Project = {
      id,
      name: finalName,
      framework: normalized.framework ?? 'react-vite',
      status: 'draft',
      updatedAt: nowIso,
      thumbnailColor: normalized.thumbnailColor ?? '#059669',
      ...(initialPrompt ? { initialPrompt } : {}),
    };

    const seedFiles = buildSeedFilesForProject(project);
    const promptState = createDefaultPromptState(project, initialPrompt);
    const ws: StoredWorkspace = {
      project,
      files: seedFiles,
      messages: [],
      revisions: [createBaselineRevision(seedFiles, project)],
      promptState,
    };

    this.workspaces.set(id, ws);
    this.persist();
    return ws;
  }

  updateWorkspace(id: string, patch: WorkspaceUpdatePatch): StoredWorkspace | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;

    if (patch.status) ws.project.status = patch.status;
    if (patch.name && patch.name.trim().length > 0) {
      ws.project.name = patch.name.trim().slice(0, 64);
    }
    if (patch.thumbnailColor) {
      ws.project.thumbnailColor = patch.thumbnailColor;
    }
    if (patch.files) {
      ws.files = normalizeFiles(patch.files);
      const meta: RevisionSnapshotMeta = patch.revisionMeta ?? {
        summary: `Updated workspace (${ws.files.length} files)`,
        source: patch.appendMessages && patch.appendMessages.length > 0 ? 'ai-generation' : 'manual',
        agent: patch.promptState?.activeAgent ?? ws.promptState.activeAgent,
        prompt: patch.promptState?.activePrompt ?? null,
      };
      const nextRev = createNextRevisionRecord(ws.revisions, ws.files, meta);
      ws.revisions = [nextRev, ...ws.revisions];
    }
    if (patch.replaceMessages) {
      ws.messages = patch.replaceMessages.map((m) => ({ ...m }));
    } else if (patch.appendMessages && patch.appendMessages.length > 0) {
      ws.messages = [...ws.messages, ...patch.appendMessages];
    }
    if (patch.promptState) {
      ws.promptState = {
        ...ws.promptState,
        ...patch.promptState,
        updatedAt: new Date().toISOString(),
      };
    }

    ws.project.updatedAt = new Date().toISOString();
    this.persist();
    return ws;
  }

  labelRevision(id: string, revisionId: string, label: string): StoredWorkspace | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;
    const clean = label.trim().slice(0, 80);
    if (!clean) return null;
    const target = ws.revisions.find((r) => r.id === revisionId);
    if (!target) return null;

    target.label = clean;
    ws.project.updatedAt = new Date().toISOString();
    this.persist();
    return ws;
  }

  rollbackToRevision(id: string, revisionId: string): StoredWorkspace | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;
    const target = ws.revisions.find((r) => r.id === revisionId);
    if (!target) return null;

    const restoredFiles = target.files.map((f) => {
      const current = ws.files.find((cf) => cf.path === f.path);
      return {
        path: f.path,
        content: f.content,
        version: Math.max(f.version, current?.version ?? 0) + 1,
      };
    });

    const recoveredStatus: Project['status'] =
      target.source === 'seed' &&
      restoredFiles.some(
        (f) =>
          f.path === 'src/App.tsx' &&
          (f.content.includes('Draft workspace ready.') || f.content.includes('Initialized from prompt:'))
      )
        ? 'draft'
        : 'ready';

    return this.updateWorkspace(id, {
      status: recoveredStatus,
      files: restoredFiles,
      revisionMeta: {
        label: `Rollback to v${target.version}`,
        summary: `Rolled back workspace files to v${target.version} (${target.label})`,
        source: 'rollback',
      },
      promptState: {
        phase: recoveredStatus === 'ready' ? 'completed' : 'idle',
        activePrompt: null,
        activeAgent: null,
        lastError: null,
        revisionCount: ws.revisions.length + 1,
      },
    });
  }

  setPromptState(id: string, patch: Partial<ProjectPromptState>): StoredWorkspace | null {
    return this.updateWorkspace(id, { promptState: patch });
  }

  private isReadyWorkspace(ws: StoredWorkspace): boolean {
    const appFile = ws.files.find(
      (f) => f.path === 'src/App.tsx' || f.path === 'src/App.jsx'
    );
    const isDraftTemplate =
      !appFile ||
      appFile.content.includes('Draft workspace ready.') ||
      appFile.content.includes('Initialized from prompt:');
    return !isDraftTemplate || ws.promptState.revisionCount > 0;
  }

  resetPromptState(id: string): StoredWorkspace | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;

    const recoveredStatus: Project['status'] = this.isReadyWorkspace(ws)
      ? 'ready'
      : 'draft';

    return this.updateWorkspace(id, {
      status: recoveredStatus,
      promptState: {
        phase: recoveredStatus === 'ready' ? 'completed' : 'idle',
        activePrompt: null,
        activeAgent: null,
        lastError: null,
      },
    });
  }

  branchProject(id: string, branchName?: string): StoredWorkspace | null {
    const source = this.workspaces.get(id);
    if (!source) return null;

    const copyId = `${source.project.id}_br_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();
    const resolvedName =
      branchName && branchName.trim().length > 0
        ? branchName.trim().slice(0, 64)
        : `${source.project.name} (Branch)`;

    const branchReady =
      source.project.status === 'ready' || this.isReadyWorkspace(source);

    const copyProject: Project = {
      ...source.project,
      id: copyId,
      name: resolvedName,
      status: branchReady ? 'ready' : 'draft',
      updatedAt: nowIso,
      branchedFromId: source.project.id,
      branchedFromName: source.project.name,
    };

    const clonedFiles = source.files.map((f) => ({ ...f }));
    const ws: StoredWorkspace = {
      project: copyProject,
      files: clonedFiles,
      messages: source.messages.map((m) => ({ ...m })),
      revisions: [
        createNextRevisionRecord([], clonedFiles, {
          label: `Branched from ${source.project.name}`,
          summary: `Branched workspace (${clonedFiles.length} files)`,
          source: 'branch',
        }),
      ],
      promptState: {
        phase: 'idle',
        activePrompt: null,
        activeAgent: null,
        strategy: source.promptState.strategy,
        lastComplexity: source.promptState.lastComplexity,
        lastError: null,
        revisionCount: source.promptState.revisionCount,
        updatedAt: nowIso,
      },
    };

    this.workspaces.set(copyId, ws);
    this.persist();
    return ws;
  }

  duplicateProject(id: string): StoredWorkspace | null {
    const source = this.workspaces.get(id);
    if (!source) return null;
    return this.branchProject(id, `${source.project.name} (Copy)`);
  }

  deleteProject(id: string): boolean {
    const deleted = this.workspaces.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }
}

export const projectStore = new ProjectStore();
