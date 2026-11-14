import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Mic, Paperclip, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { HERO_SUGGESTION_PROMPTS } from '../../features/generation/mock';
import { cn, validatePrompt } from '../../lib/utils';
import { Tooltip } from '../ui/tooltip';
import { SuggestionPill } from './suggestion-pill';

interface AIChatBoxProps {
  variant?: 'hero' | 'compact';
  theme?: 'light' | 'dark';
  onSubmit?: (prompt: string) => void;
  initialValue?: string;
  placeholder?: string;
  showSuggestions?: boolean;
  submitLabel?: string;
  className?: string;
}

const MODEL_OPTIONS = ['DeepSeek-V3', 'DeepSeek-R1 Fast'] as const;

export function AIChatBox({
  variant = 'hero',
  theme = 'light',
  onSubmit,
  initialValue = '',
  placeholder = 'Describe the website you want to build...',
  showSuggestions = true,
  submitLabel = 'Generate',
  className,
}: AIChatBoxProps) {
  const [prompt, setPrompt] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [modelIndex, setModelIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isHero = variant === 'hero';
  const isDark = theme === 'dark';
  const activeModel = MODEL_OPTIONS[modelIndex];

  const handleSelectSuggestion = (value: string) => {
    setPrompt(value);
    setError(null);
    textareaRef.current?.focus();
  };

  const submitPrompt = () => {
    const result = validatePrompt(prompt);
    if (!result.ok) {
      setError(result.error);
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    if (onSubmit) {
      onSubmit(result.value);
      if (!isHero) {
        setPrompt('');
      }
      return;
    }
    toast.info('Generation is coming soon — this is the UI shell.');
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitPrompt();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  };

  const cycleModel = () => {
    const next = (modelIndex + 1) % MODEL_OPTIONS.length;
    setModelIndex(next);
    toast.success(`Switched model preset to ${MODEL_OPTIONS[next]}`);
  };

  const formElement = (
    <form
      onSubmit={handleFormSubmit}
      noValidate
      className={cn(
        'relative w-full rounded-xl border transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2',
        isDark
          ? 'border-zinc-800 bg-zinc-900 text-zinc-100 focus-within:border-emerald-500/70 focus-within:ring-offset-zinc-950'
          : 'border-slate-200 bg-white text-slate-900 focus-within:border-emerald-500/70 focus-within:ring-offset-white',
        isHero
          ? 'p-4 shadow-2xl shadow-emerald-500/10'
          : 'p-3 shadow-sm',
        className
      )}
    >
      {showSuggestions ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {HERO_SUGGESTION_PROMPTS.map((item) => (
            <SuggestionPill
              key={item}
              label={item}
              active={prompt.trim() === item}
              onSelect={handleSelectSuggestion}
            />
          ))}
        </div>
      ) : null}

      <div>
        <label htmlFor={`ai-prompt-${variant}-${theme}`} className="sr-only">
          Website prompt
        </label>
        <textarea
          ref={textareaRef}
          id={`ai-prompt-${variant}-${theme}`}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={isHero ? 3 : 2}
          className={cn(
            'w-full resize-none border-0 bg-transparent text-sm leading-relaxed focus:outline-none',
            isDark
              ? 'text-zinc-100 placeholder:text-zinc-500'
              : 'text-slate-900 placeholder:text-slate-400',
            isHero ? 'min-h-[96px] text-base' : 'min-h-[64px]'
          )}
        />
      </div>

      {error ? (
        <p role="alert" className={cn('mb-2 text-xs font-medium', isDark ? 'text-red-400' : 'text-red-600')}>
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          'mt-2 flex items-center justify-between gap-2 border-t pt-2',
          isDark ? 'border-zinc-800' : 'border-slate-100'
        )}
      >
        <div className="flex items-center gap-1">
          <Tooltip label={`Switch preset (${activeModel})`}>
            <button
              type="button"
              onClick={cycleModel}
              aria-label={`Model: ${activeModel}`}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                isDark
                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-offset-zinc-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Sparkles className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
              <span className="hidden sm:inline whitespace-nowrap">{activeModel}</span>
            </button>
          </Tooltip>

          <Tooltip label="Attach reference">
            <button
              type="button"
              onClick={() => toast.info('Reference image attachments are pending backend upload storage.')}
              aria-label="Attach reference"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                isDark
                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-offset-zinc-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </Tooltip>

          <Tooltip label="Voice prompt">
            <button
              type="button"
              onClick={() => toast.info('Voice prompt capture is pending browser audio integration.')}
              aria-label="Voice prompt"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                isDark
                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-offset-zinc-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Mic className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </Tooltip>
        </div>

        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
        >
          <span>{submitLabel}</span>
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </form>
  );

  if (!isHero) {
    return formElement;
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl before:pointer-events-none before:absolute before:-inset-1 before:-z-10 before:rounded-2xl before:bg-gradient-to-r before:from-emerald-500/25 before:via-teal-400/20 before:to-emerald-600/25 before:blur-xl before:opacity-75">
      {formElement}
    </div>
  );
}
