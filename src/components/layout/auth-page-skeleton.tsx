export function AuthPageSkeleton() {
  return (
    <div className="grid min-h-screen bg-[#FAFAFA] lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-6 space-y-4">
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-emerald-100" />
            </div>
          </div>
        </div>
      </div>
      <div className="hidden border-l border-zinc-800 bg-zinc-950 lg:block" />
    </div>
  );
}
