import type { Project, ProjectFile, ProjectStatus, ProjectWithFiles } from './types';

const now = new Date('2026-11-13T10:37:00Z').getTime();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86400 * 1000).toISOString();

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'mock-1',
    name: 'Kopi Senja — Landing Page',
    framework: 'react-vite',
    status: 'ready',
    updatedAt: hoursAgo(2),
    thumbnailColor: '#10B981',
  },
  {
    id: 'prj_nadia_portfolio',
    name: 'Nadia Portfolio',
    framework: 'react-vite',
    status: 'ready',
    updatedAt: daysAgo(1),
    thumbnailColor: '#0F172A',
  },
  {
    id: 'prj_invoice_ui',
    name: 'Invoice Dashboard UI',
    framework: 'react-vite',
    status: 'generating',
    updatedAt: new Date(now).toISOString(),
    thumbnailColor: '#F59E0B',
  },
  {
    id: 'prj_wedding_invite',
    name: 'Wedding Invitation',
    framework: 'react-vite',
    status: 'draft',
    updatedAt: daysAgo(3),
    thumbnailColor: '#64748B',
  },
  {
    id: 'prj_klinik_sehat',
    name: 'Klinik Sehat — Homepage',
    framework: 'react-vite',
    status: 'failed',
    updatedAt: daysAgo(5),
    thumbnailColor: '#EF4444',
  },
];

export const DEFAULT_PROJECT_FILES: ProjectFile[] = [
  {
    path: 'src/App.tsx',
    version: 3,
    content: `export default function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-700">
          Single-Origin Roastery · Jakarta
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight">
          Kopi Senja, roasted every dawn.
        </h1>
        <p className="mt-4 max-w-xl text-base text-stone-600">
          Small-batch Arabica from Gayo and Flores, brewed slowly for quiet mornings.
        </p>
      </section>
    </main>
  );
}`,
  },
  {
    path: 'package.json',
    version: 1,
    content: `{
  "name": "kopi-senja-landing",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}`,
  },
];

export function getMockProjectWithFiles(projectId: string): ProjectWithFiles {
  const found = MOCK_PROJECTS.find((p) => p.id === projectId) ?? MOCK_PROJECTS[0];
  return {
    ...found,
    files: DEFAULT_PROJECT_FILES,
  };
}

export function filterProjects(
  projects: Project[],
  query: string,
  statusFilter: ProjectStatus | 'all'
): Project[] {
  const q = query.trim().toLowerCase();
  return projects.filter((project) => {
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesQuery =
      q.length === 0 ||
      project.name.toLowerCase().includes(q) ||
      project.framework.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });
}

export function duplicateProjectInList(projects: Project[], id: string): Project[] {
  const source = projects.find((p) => p.id === id);
  if (!source) return projects;
  const copy: Project = {
    ...source,
    id: `${source.id}_copy_${Date.now().toString(36)}`,
    name: `${source.name} (Copy)`,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
  return [copy, ...projects];
}

export function deleteProjectFromList(projects: Project[], id: string): Project[] {
  return projects.filter((p) => p.id !== id);
}
