import type { ProjectFile } from '../projects/types';

export interface PreviewBuildInput {
  files: ProjectFile[];
}

export interface PreviewBuildResult {
  htmlUrl: string | null; // Blob URL
  error: string | null;
}

export type BuildPreview = (input: PreviewBuildInput) => Promise<PreviewBuildResult>;
