'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { AIChatBox } from '../../components/shared/ai-chat-box';
import { useWorkspaceStore } from '../../features/projects/workspace-store';

export function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') ?? '';
  const { createWorkspace } = useWorkspaceStore();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (prompt: string) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await createWorkspace({ initialPrompt: prompt });
      toast.success(`Initialized workspace "${created.name}".`);
      router.push(`/projects/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initialize workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DashboardLayout breadcrumb="New Project">
      <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center md:py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-700">
          New Workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl text-balance">
          What would you like to build?
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
          Describe your app to initialize a persisted workspace, queue your prompt state, and open the builder.
        </p>

        <div className="mt-8 w-full text-left">
          <AIChatBox
            variant="compact"
            initialValue={initialPrompt}
            submitLabel={isCreating ? 'Initializing...' : 'Create Project'}
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
