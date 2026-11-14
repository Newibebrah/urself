import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import { ProjectRepository } from './projects/repository';

export interface ApiContext {
  supabase: SupabaseClient;
  user: User;
  repo: ProjectRepository;
}

export async function getApiContext(): Promise<ApiContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      supabase,
      user,
      repo: new ProjectRepository(supabase, user.id),
    };
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export function notFound(error = 'Not found') {
  return Response.json({ error }, { status: 404 });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  return Response.json({ error: message }, { status: 500 });
}

/**
 * Log token usage to Supabase after an AI call.
 * 
 * @param supabase - Supabase server client
 * @param tenantId - User's Supabase auth ID
 * @param model - Model name (e.g., 'deepseek-chat', 'claude-3-5-haiku-latest')
 * @param prompt - The original prompt text
 * @param completion - The model's response text
 */
export async function logTokenUsage(
  supabase: ReturnType<typeof createSupabaseServerClient>['supabase'],
  tenantId: string,
  model: string,
  prompt: string,
  completion: string
) {
  const { promptTokens, completionTokens } = countTokensBoth(prompt, completion);

  const { error } = await supabase.from('token_usages').insert({
    tenant_id: tenantId,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to log token usage:', error.message);
    return false;
  }

  // Note: quota deduction is handled via a separate mechanism
  // In production, this would update the user's remaining quota
  return true;
}
