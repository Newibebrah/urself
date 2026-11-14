import {
  validateProjectForExport,
  type ExportValidationResult,
} from './project-inspector';
import type { Framework, ProjectFile } from './types';

export type ZipExportStageId = 'validating' | 'bundling' | 'archiving';

export type ZipExportStepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ZipExportStep {
  id: ZipExportStageId;
  label: string;
  status: ZipExportStepStatus;
  detail: string;
}

export interface ZipExportProgressState {
  activeStage: ZipExportStageId;
  percent: number;
  headline: string;
  detail: string;
  steps: ZipExportStep[];
  error: string | null;
  completed: boolean;
  fileName: string | null;
  bytesDownloaded: number;
  totalBytes: number | null;
}

export const ZIP_EXPORT_STAGE_DEFS: ReadonlyArray<{
  id: ZipExportStageId;
  label: string;
  defaultDetail: string;
}> = [
  {
    id: 'validating',
    label: 'Validating Project',
    defaultDetail: 'Checking root entry component, package manifest, and module imports.',
  },
  {
    id: 'bundling',
    label: 'Bundling Assets',
    defaultDetail: 'Syncing workspace edits and verifying bundle compilation with esbuild.',
  },
  {
    id: 'archiving',
    label: 'Generating Archive',
    defaultDetail: 'Packaging verified React + Vite project files into a compressed ZIP archive.',
  },
];

export function buildZipExportProgressSnapshot(params: {
  activeStage: ZipExportStageId;
  percent: number;
  detail: string;
  error?: string | null;
  completed?: boolean;
  fileName?: string | null;
  bytesDownloaded?: number;
  totalBytes?: number | null;
  stepDetails?: Partial<Record<ZipExportStageId, string>>;
}): ZipExportProgressState {
  const stageOrder: ZipExportStageId[] = ['validating', 'bundling', 'archiving'];
  const activeIdx = stageOrder.indexOf(params.activeStage);
  const completed = Boolean(params.completed);
  const error = params.error ?? null;

  const steps: ZipExportStep[] = ZIP_EXPORT_STAGE_DEFS.map((def, idx) => {
    let status: ZipExportStepStatus = 'pending';
    if (completed) {
      status = 'completed';
    } else if (idx < activeIdx) {
      status = 'completed';
    } else if (idx === activeIdx) {
      status = error ? 'error' : 'active';
    }

    const customDetail = params.stepDetails?.[def.id];
    const stepDetail =
      customDetail ?? (idx === activeIdx ? params.detail : def.defaultDetail);

    return {
      id: def.id,
      label: def.label,
      status,
      detail: stepDetail,
    };
  });

  const activeDef = ZIP_EXPORT_STAGE_DEFS[activeIdx] ?? ZIP_EXPORT_STAGE_DEFS[0];
  const headline = completed
    ? 'ZIP Archive Ready'
    : error
    ? `${activeDef.label} failed`
    : activeDef.label;

  return {
    activeStage: params.activeStage,
    percent: Math.max(0, Math.min(100, Math.round(params.percent))),
    headline,
    detail: params.detail,
    steps,
    error,
    completed,
    fileName: params.fileName ?? null,
    bytesDownloaded: params.bytesDownloaded ?? 0,
    totalBytes: params.totalBytes ?? null,
  };
}

function parseContentDispositionFileName(header: string | null, fallbackName: string): string {
  if (header) {
    const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  const slug =
    fallbackName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'urself-project';
  return `${slug}.zip`;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function waitStepDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Export aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RunZipExportParams {
  projectName: string;
  framework: Framework;
  files: ProjectFile[];
  dirtyFiles: boolean;
  exportUrl: string;
  signal?: AbortSignal;
  stepDelayMs?: number;
  onProgress: (state: ZipExportProgressState) => void;
  saveWorkspaceFiles?: (files: ProjectFile[]) => Promise<void>;
  verifyBundle?: (files: ProjectFile[]) => Promise<{ error: string | null }>;
  fetchImpl?: typeof fetch;
  downloadBlob?: (blob: Blob, fileName: string) => void;
}

export interface RunZipExportResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  validation?: ExportValidationResult;
  fileName?: string;
  bytes?: number;
}

export async function runZipExportPipeline(
  params: RunZipExportParams
): Promise<RunZipExportResult> {
  const delayMs = params.stepDelayMs ?? 150;
  const fetchFn = params.fetchImpl ?? fetch;
  const downloadFn = params.downloadBlob ?? triggerBlobDownload;
  const completedStepDetails: Partial<Record<ZipExportStageId, string>> = {};

  try {
    // Stage 1: Validating Project
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'validating',
        percent: 18,
        detail: `Inspecting ${params.files.length} workspace file${params.files.length === 1 ? '' : 's'} and import graph...`,
      })
    );

    const validation = validateProjectForExport(params.files, params.framework);
    if (!validation.valid) {
      const errorMsg = `Export blocked: ${validation.errorCount} validation error${validation.errorCount === 1 ? '' : 's'} found.`;
      params.onProgress(
        buildZipExportProgressSnapshot({
          activeStage: 'validating',
          percent: 18,
          detail: errorMsg,
          error: errorMsg,
        })
      );
      return { ok: false, error: errorMsg, validation };
    }

    completedStepDetails.validating = `Passed ${validation.checks.length} structural & syntax checks.`;
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'validating',
        percent: 34,
        detail: completedStepDetails.validating,
        stepDetails: completedStepDetails,
      })
    );
    await waitStepDelay(delayMs, params.signal);

    // Stage 2: Bundling Assets
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'bundling',
        percent: 56,
        detail: params.dirtyFiles
          ? 'Saving latest workspace edits and verifying bundle with esbuild...'
          : 'Verifying React + Vite asset graph with esbuild...',
        stepDetails: completedStepDetails,
      })
    );

    if (params.dirtyFiles && params.saveWorkspaceFiles) {
      await params.saveWorkspaceFiles(params.files);
    }

    if (params.verifyBundle) {
      const bundleCheck = await params.verifyBundle(params.files);
      if (bundleCheck.error) {
        const bundleErr = `Bundle verification failed: ${bundleCheck.error}`;
        params.onProgress(
          buildZipExportProgressSnapshot({
            activeStage: 'bundling',
            percent: 56,
            detail: bundleErr,
            error: bundleErr,
            stepDetails: completedStepDetails,
          })
        );
        return { ok: false, error: bundleErr, validation };
      }
    }

    completedStepDetails.bundling = `Compiled and verified ${params.files.length} project assets cleanly.`;
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'bundling',
        percent: 72,
        detail: completedStepDetails.bundling,
        stepDetails: completedStepDetails,
      })
    );
    await waitStepDelay(delayMs, params.signal);

    // Stage 3: Generating Archive
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'archiving',
        percent: 82,
        detail: 'Compressing project directory into ZIP archive...',
        stepDetails: completedStepDetails,
      })
    );

    const response = await fetchFn(params.exportUrl, { signal: params.signal });
    if (!response.ok) {
      const httpErr = `ZIP archive generation failed (HTTP ${response.status}).`;
      params.onProgress(
        buildZipExportProgressSnapshot({
          activeStage: 'archiving',
          percent: 82,
          detail: httpErr,
          error: httpErr,
          stepDetails: completedStepDetails,
        })
      );
      return { ok: false, error: httpErr, validation };
    }

    const fileName = parseContentDispositionFileName(
      response.headers.get('content-disposition'),
      params.projectName
    );
    const rawLength = response.headers.get('content-length');
    const totalBytes = rawLength ? Number.parseInt(rawLength, 10) || null : null;

    let blob: Blob;
    let bytesDownloaded = 0;

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          bytesDownloaded += value.byteLength;
          const pct = totalBytes
            ? 82 + Math.min(16, Math.round((bytesDownloaded / totalBytes) * 16))
            : 92;
          params.onProgress(
            buildZipExportProgressSnapshot({
              activeStage: 'archiving',
              percent: pct,
              detail: `Streaming ${fileName} (${bytesDownloaded.toLocaleString()} bytes)...`,
              fileName,
              bytesDownloaded,
              totalBytes,
              stepDetails: completedStepDetails,
            })
          );
        }
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      blob = new Blob([merged], { type: 'application/zip' });
      bytesDownloaded = totalLen;
    } else {
      blob = await response.blob();
      bytesDownloaded = blob.size;
    }

    completedStepDetails.archiving = `Packaged ${fileName} (${bytesDownloaded.toLocaleString()} bytes).`;
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'archiving',
        percent: 100,
        detail: completedStepDetails.archiving,
        completed: true,
        fileName,
        bytesDownloaded,
        totalBytes: totalBytes ?? bytesDownloaded,
        stepDetails: completedStepDetails,
      })
    );

    downloadFn(blob, fileName);
    await waitStepDelay(Math.min(delayMs * 2, 320), params.signal);

    return {
      ok: true,
      validation,
      fileName,
      bytes: bytesDownloaded,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, cancelled: true };
    }
    const msg = err instanceof Error ? err.message : 'ZIP export failed unexpectedly.';
    params.onProgress(
      buildZipExportProgressSnapshot({
        activeStage: 'archiving',
        percent: 82,
        detail: msg,
        error: msg,
        stepDetails: completedStepDetails,
      })
    );
    return { ok: false, error: msg };
  }
}
