import { z } from 'zod';
import type { ProjectFile } from '../../features/projects/types.ts';
import type { PromptAnalysis } from './prompt-analyzer.ts';

export type TemplateId =
  | 'landing-page'
  | 'dashboard'
  | 'auth-login'
  | 'portfolio'
  | 'saas-pricing'
  | 'storefront';

export interface TemplateContract {
  templateId: TemplateId;
  displayName: string;
  description: string;
  requiredFiles: string[];
  allowedFiles: string[];
  allowedPackages: string[];
  defaultSections: string[];
}

export interface Phase1BlueprintSelection {
  templateId: TemplateId;
  displayName: string;
  rationale: string;
  requiredSections: string[];
  contract: TemplateContract;
  selectorProvider: 'haiku-fast' | 'deepseek-fast' | 'deterministic-selector';
}

export const GENERATED_FILE_SCHEMA = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .refine((p) => !p.includes('..') && !p.startsWith('/'), {
      message: 'File path must be workspace-relative without path traversal',
    }),
  content: z.string().min(1, 'Generated file content cannot be empty'),
});

export const GENERATED_PAYLOAD_SCHEMA = z.object({
  files: z.array(GENERATED_FILE_SCHEMA).min(1, 'At least one file must be generated'),
  summary: z.string().min(1).max(400).optional(),
});

export const PHASE1_SELECTION_SCHEMA = z.object({
  templateId: z.enum([
    'landing-page',
    'dashboard',
    'auth-login',
    'portfolio',
    'saas-pricing',
    'storefront',
  ]),
  rationale: z.string().min(1).max(400),
  requiredSections: z.array(z.string().min(1)).min(1).max(8),
});

const COMMON_ALLOWED_PACKAGES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'lucide-react',
];

const COMMON_ALLOWED_FILES = [
  'src/App.tsx',
  'src/App.jsx',
  'src/index.css',
  'src/components/Navbar.tsx',
  'src/components/Hero.tsx',
  'src/components/Sections.tsx',
  'src/components/BrandAssets.tsx',
  'src/components/ShowcaseGrid.tsx',
  'src/components/Footer.tsx',
  'package.json',
];

export const TEMPLATE_CONTRACTS: Record<TemplateId, TemplateContract> = {
  'landing-page': {
    templateId: 'landing-page',
    displayName: 'Landing Page',
    description: 'High-contrast hero landing page with navigation, feature sections, and CTA footer.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [...COMMON_ALLOWED_FILES, 'src/components/Features.tsx', 'src/components/FAQ.tsx'],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['Hero', 'Features', 'SocialProof', 'Footer'],
  },
  dashboard: {
    templateId: 'dashboard',
    displayName: 'Dashboard',
    description: 'Operational workspace with KPI summary cards, filterable table, and activity log.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [
      ...COMMON_ALLOWED_FILES,
      'src/components/Sidebar.tsx',
      'src/components/MetricsGrid.tsx',
      'src/components/DataTable.tsx',
    ],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['TopMetrics', 'RevenueTable', 'ActivityFeed'],
  },
  'auth-login': {
    templateId: 'auth-login',
    displayName: 'Form Login',
    description: 'Split-screen authentication experience with client validation and feedback states.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [...COMMON_ALLOWED_FILES, 'src/components/AuthForm.tsx'],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['AuthPanel', 'SecurityHighlights', 'Footer'],
  },
  portfolio: {
    templateId: 'portfolio',
    displayName: 'Portfolio',
    description: 'Editorial portfolio showcasing selected case studies, timeline, and direct contact.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [...COMMON_ALLOWED_FILES, 'src/components/ProjectGrid.tsx'],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['Hero', 'SelectedWork', 'Experience', 'Contact'],
  },
  'saas-pricing': {
    templateId: 'saas-pricing',
    displayName: 'SaaS Pricing',
    description: 'Pricing comparison layout with billing toggle, highlighted Pro tier, and FAQ.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [...COMMON_ALLOWED_FILES, 'src/components/PricingGrid.tsx', 'src/components/FAQ.tsx'],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['Hero', 'PricingTiers', 'Comparison', 'FAQ'],
  },
  storefront: {
    templateId: 'storefront',
    displayName: 'Storefront',
    description: 'Catalog storefront with category filter tabs, product cards, and store details.',
    requiredFiles: ['src/App.tsx'],
    allowedFiles: [...COMMON_ALLOWED_FILES, 'src/components/CatalogGrid.tsx'],
    allowedPackages: COMMON_ALLOWED_PACKAGES,
    defaultSections: ['Hero', 'Catalog', 'StoreHours', 'Footer'],
  },
};

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  disallowedPaths: string[];
  disallowedPackages: string[];
}

function normalizeContractPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function extractBarePackageImports(content: string): string[] {
  const packages: string[] = [];
  const regex = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const spec = m[1].trim();
    if (!spec || spec.startsWith('.') || spec.startsWith('@/')) continue;
    packages.push(spec);
  }
  return packages;
}

export function validateAgainstContract(
  files: Array<Pick<ProjectFile, 'path' | 'content'>>,
  contract: TemplateContract
): ContractValidationResult {
  const errors: string[] = [];
  const disallowedPaths: string[] = [];
  const disallowedPackages: string[] = [];

  const schemaCheck = GENERATED_PAYLOAD_SCHEMA.safeParse({ files });
  if (!schemaCheck.success) {
    for (const issue of schemaCheck.error.issues) {
      errors.push(`${issue.path.join('.') || 'payload'}: ${issue.message}`);
    }
  }

  const normalizedFiles = files.map((f) => ({
    path: normalizeContractPath(f.path),
    content: f.content,
  }));
  const filePaths = new Set(normalizedFiles.map((f) => f.path));

  // Verify required entry file(s) exist (accept App.jsx as equivalent to App.tsx)
  for (const reqPath of contract.requiredFiles) {
    if (reqPath === 'src/App.tsx') {
      if (!filePaths.has('src/App.tsx') && !filePaths.has('src/App.jsx')) {
        errors.push('Missing required entry file src/App.tsx (or src/App.jsx).');
      }
    } else if (!filePaths.has(reqPath)) {
      errors.push(`Missing required contract file: ${reqPath}.`);
    }
  }

  // Enforce strict file whitelist & allowed package whitelist
  const allowedSet = new Set(contract.allowedFiles.map(normalizeContractPath));
  const pkgAllowedSet = new Set(contract.allowedPackages);

  for (const file of normalizedFiles) {
    if (!allowedSet.has(file.path) && !file.path.startsWith('src/components/')) {
      disallowedPaths.push(file.path);
      errors.push(`File "${file.path}" violates template contract whitelist for ${contract.displayName}.`);
    }

    if (/\.(tsx|ts|jsx|js)$/i.test(file.path)) {
      const bareImports = extractBarePackageImports(file.content);
      for (const pkg of bareImports) {
        if (!pkgAllowedSet.has(pkg)) {
          disallowedPackages.push(pkg);
          errors.push(
            `File "${file.path}" imports disallowed package "${pkg}" (allowed: ${contract.allowedPackages.join(', ')}).`
          );
        }
      }
    }
  }

  const entryFile = normalizedFiles.find((f) => f.path === 'src/App.tsx' || f.path === 'src/App.jsx');
  if (entryFile && !/export\s+default\s+/.test(entryFile.content)) {
    errors.push(`${entryFile.path} must declare an "export default" component.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    disallowedPaths,
    disallowedPackages,
  };
}

function classifyTemplateDeterministic(prompt: string, analysis: PromptAnalysis): TemplateId {
  const lower = prompt.toLowerCase();
  if (/(login|sign\s*in|register|auth|password|masuk|daftar|form\s*login)/.test(lower)) {
    return 'auth-login';
  }
  if (
    analysis.domain === 'dashboard-analytics' ||
    /(dashboard|analytics|admin|kpi|ledger|invoice|metrics|crm|monitoring)/.test(lower)
  ) {
    return 'dashboard';
  }
  if (
    analysis.domain === 'saas-pricing' ||
    /(pricing|tier|plan|subscription|paket\s*harga)/.test(lower)
  ) {
    return 'saas-pricing';
  }
  if (analysis.domain === 'portfolio' || /(portfolio|cv|resume|designer|photographer)/.test(lower)) {
    return 'portfolio';
  }
  if (
    analysis.domain === 'coffee-hospitality' ||
    /(catalog|shop|store|menu|product|roast|toko|katalog)/.test(lower)
  ) {
    return 'storefront';
  }
  return 'landing-page';
}

function isApiKeyReady(val?: string): boolean {
  return Boolean(val && val.trim().length > 0 && !val.trim().startsWith('MY_'));
}

/**
 * Phase 1: Blueprint & Contract Selection.
 * Uses a fast selector LLM when configured, with deterministic schema-backed classification fallback.
 */
export async function selectBlueprintPhase1(
  prompt: string,
  analysis: PromptAnalysis,
  existingFiles: ProjectFile[] = []
): Promise<Phase1BlueprintSelection> {
  const fallbackTemplateId = classifyTemplateDeterministic(prompt, analysis);
  const fallbackContract = TEMPLATE_CONTRACTS[fallbackTemplateId];

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();

  // Only invoke remote Phase 1 classifier if a real API key is configured and existing files do not already lock context
  if (isApiKeyReady(anthropicKey) && process.env.NODE_ENV !== 'test') {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(6000),
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-latest',
          max_tokens: 320,
          temperature: 0,
          system:
            'Select the best templateId from ["landing-page","dashboard","auth-login","portfolio","saas-pricing","storefront"] and respond ONLY in JSON: {"templateId":string,"rationale":string,"requiredSections":string[]}.',
          messages: [
            {
              role: 'user',
              content: `Prompt: ${prompt}\nExisting files: ${existingFiles.map((f) => f.path).join(', ') || 'none'}`,
            },
          ],
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';
        const first = rawText.indexOf('{');
        const last = rawText.lastIndexOf('}');
        if (first !== -1 && last > first) {
          const parsed = PHASE1_SELECTION_SCHEMA.safeParse(JSON.parse(rawText.slice(first, last + 1)));
          if (parsed.success) {
            const contract = TEMPLATE_CONTRACTS[parsed.data.templateId];
            return {
              templateId: parsed.data.templateId,
              displayName: contract.displayName,
              rationale: parsed.data.rationale,
              requiredSections: parsed.data.requiredSections,
              contract,
              selectorProvider: 'haiku-fast',
            };
          }
        }
      }
    } catch {
      // fall through cleanly to deterministic selector
    }
  } else if (isApiKeyReady(deepseekKey) && process.env.NODE_ENV !== 'test') {
    // Allow fast deterministic selection without burning an extra slow remote call unless needed,
    // preserving low latency while keeping schema guarantees intact.
    return {
      templateId: fallbackTemplateId,
      displayName: fallbackContract.displayName,
      rationale: `Phase 1 selected "${fallbackContract.displayName}" blueprint (${analysis.requestedSections.join(', ')}).`,
      requiredSections:
        analysis.requestedSections.length > 0
          ? analysis.requestedSections
          : fallbackContract.defaultSections,
      contract: fallbackContract,
      selectorProvider: 'deterministic-selector',
    };
  }

  return {
    templateId: fallbackTemplateId,
    displayName: fallbackContract.displayName,
    rationale: `Phase 1 selected "${fallbackContract.displayName}" blueprint contract (${fallbackContract.allowedPackages.join(', ')}).`,
    requiredSections:
      analysis.requestedSections.length > 0
        ? analysis.requestedSections
        : fallbackContract.defaultSections,
    contract: fallbackContract,
    selectorProvider: 'deterministic-selector',
  };
}
