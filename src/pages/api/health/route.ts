import { createClient } from '@supabase/ssr';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('token_usages').select('*', { count: 'exact', head: true });
  
  return new Response(
    JSON.stringify({ 
      status: 'ok', 
      message: 'API is working',
      tokenCount: data || 0 
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
