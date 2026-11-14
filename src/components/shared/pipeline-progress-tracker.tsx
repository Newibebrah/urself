import { CheckCircle2, Code2, Cpu, LayoutTemplate, Loader2, Wrench } from 'lucide-react';
import { AgentManager } from '../../features/generation/agent-manager';
import type {
  AgentSource,
  BlueprintChunkMeta,
  ComplexityProfile,
  GenerationStage,
  OrchestrationStrategy,
  RagPatternChunkMeta,
} from '../../features/generation/types';
import { cn } from '../../lib/utils';

export interface PipelineProgressTrackerProps {
  pipelineStatus: string | null;
  pipelineStage?: GenerationStage | null;
  agent?: AgentSource | null;
  strategy?: OrchestrationStrategy;
  complexity?: ComplexityProfile | null;
  blueprint?: BlueprintChunkMeta | null;
  ragPatterns?: RagPatternChunkMeta[];
  theme?: 'light' | 'dark';
}

const WIDTH_CLASS_BY_PERCENT: Record<number, string> = {
  18: 'w-[18%]',
  44: 'w-[44%]',
  58: 'w-[58%]',
  62: 'w-[62%]',
  76: 'w-[76%]',
  86: 'w-[86%]',
  94: 'w-[94%]',
};

export function PipelineProgressTracker({
  pipelineStatus,
  pipelineStage,
  agent,
  strategy = 'hybrid-dual',
  complexity,
  blueprint,
  ragPatterns,
  theme = 'light',
}: PipelineProgressTrackerProps) {
  if (!pipelineStatus) {
    return null;
  }

  const isDark = theme === 'dark';
  const progress = AgentManager.mapStatusToProgress(pipelineStatus, pipelineStage, agent, strategy);
  const barWidthClass = WIDTH_CLASS_BY_PERCENT[progress.percent] ?? 'w-1/2';

  const renderHeaderIcon = () => {
    const iconColor = isDark ? 'text-emerald-400' : 'text-emerald-600';
    if (progress.activeStage === 'haiku_ui') {
      return <LayoutTemplate className={cn('h-4 w-4 shrink-0', iconColor)} strokeWidth={1.5} />;
    }
    if (progress.activeStage === 'deepseek_code') {
      return <Code2 className={cn('h-4 w-4 shrink-0', iconColor)} strokeWidth={1.5} />;
    }
    if (progress.activeStage === 'self_healing') {
      return <Wrench className={cn('h-4 w-4 shrink-0', iconColor)} strokeWidth={1.5} />;
    }
    if (progress.activeStage === 'analyzing') {
      return <Cpu className={cn('h-4 w-4 shrink-0', iconColor)} strokeWidth={1.5} />;
    }
    return <Loader2 className={cn('h-4 w-4 shrink-0 animate-spin', iconColor)} strokeWidth={1.5} />;
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pipeline-progress-tracker"
      data-stage={progress.activeStage}
      data-agent={progress.activeAgent}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isDark
          ? 'border-emerald-500/40 bg-zinc-900 text-zinc-100 shadow-2xl shadow-emerald-500/10'
          : 'border-emerald-200 bg-white text-slate-900 shadow-sm'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {renderHeaderIcon()}
          <span
            className={cn(
              'text-xs font-semibold tracking-tight',
              isDark ? 'text-zinc-100' : 'text-slate-900'
            )}
          >
            {progress.headline}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {complexity ? (
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
                isDark
                  ? 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              )}
            >
              {complexity.tier} · {complexity.overallScore}/10
            </span>
          ) : null}
          <span
            className={cn(
              'font-mono text-xs font-semibold tabular-nums',
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            )}
          >
            {progress.percent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        role="progressbar"
        aria-label={progress.headline}
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'mt-3 h-1.5 w-full overflow-hidden rounded-lg',
          isDark ? 'bg-zinc-800' : 'bg-slate-100'
        )}
      >
        <div
          className={cn(
            'h-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-200 ease-out',
            barWidthClass
          )}
        />
      </div>

      {/* Pipeline Steps */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {progress.steps.map((step) => (
          <div
            key={step.id}
            data-step-state={step.state}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
              isDark
                ? cn(
                    step.state === 'active' &&
                      'border-emerald-500/40 bg-emerald-950/60 font-medium text-emerald-300',
                    step.state === 'completed' && 'border-zinc-800 bg-zinc-950 text-zinc-300',
                    step.state === 'pending' && 'border-zinc-800/80 bg-zinc-900 text-zinc-500',
                    step.state === 'skipped' &&
                      'border-dashed border-zinc-800 bg-transparent text-zinc-500 line-through'
                  )
                : cn(
                    step.state === 'active' &&
                      'border-emerald-200 bg-emerald-50/80 font-medium text-emerald-900',
                    step.state === 'completed' && 'border-slate-200 bg-slate-50 text-slate-700',
                    step.state === 'pending' && 'border-slate-200/70 bg-white text-slate-400',
                    step.state === 'skipped' &&
                      'border-dashed border-slate-200 bg-transparent text-slate-400 line-through'
                  )
            )}
          >
            {step.state === 'completed' ? (
              <CheckCircle2
                className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-emerald-400' : 'text-emerald-600')}
                strokeWidth={1.75}
              />
            ) : step.state === 'active' ? (
              <Loader2
                className={cn(
                  'h-3.5 w-3.5 shrink-0 animate-spin',
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                )}
                strokeWidth={1.75}
              />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-sm',
                  isDark ? 'bg-zinc-600' : 'bg-slate-300'
                )}
              />
            )}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
              <span className="truncate">{step.label}</span>
              <span className="shrink-0 font-mono text-[10px] opacity-75">{step.agentLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {blueprint || (ragPatterns && ragPatterns.length > 0) ? (
        <div
          data-testid="pipeline-contract-rag-meta"
          className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]"
        >
          {blueprint ? (
            <span
              title={`Allowed files: ${blueprint.allowedFiles.join(', ')}`}
              className={cn(
                'rounded-md border px-2 py-0.5',
                isDark
                  ? 'border-zinc-800 bg-zinc-950 text-zinc-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              )}
            >
              Contract: {blueprint.displayName}
            </span>
          ) : null}
          {ragPatterns && ragPatterns.length > 0 ? (
            <span
              title={ragPatterns.map((p) => `${p.title} (${p.category})`).join(', ')}
              className={cn(
                'rounded-md border px-2 py-0.5',
                isDark
                  ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              )}
            >
              RAG: {ragPatterns.map((p) => p.title).slice(0, 2).join(' + ')}
              {ragPatterns.length > 2 ? ` +${ragPatterns.length - 2}` : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      <p
        className={cn(
          'mt-2.5 truncate font-mono text-[11px] leading-relaxed',
          isDark ? 'text-zinc-400' : 'text-slate-500'
        )}
        title={progress.detail}
      >
        {progress.detail}
      </p>
    </div>
  );
}
