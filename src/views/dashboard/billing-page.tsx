'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { Progress } from '../../components/ui/progress';
import { PricingGrid } from '../../features/billing/components/pricing-grid';
import { useAuth } from '../../features/auth/auth-provider';
import { calculateUsagePercent } from '../../lib/utils';

export function BillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const projectsUsed = user?.projectsUsed ?? 0;
  const projectsMax = user?.projectsMax ?? 3;
  const revisionsUsed = user?.revisionsUsed ?? 0;
  const revisionsMax = user?.revisionsMax ?? 5;
  const tokensUsed = user?.tokensUsed ?? 0;
  const tokensLimit = user?.tokensLimit ?? 10_000;

  return (
    <DashboardLayout breadcrumb="Billing">
      <div>
        <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Billing &amp; Quota</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Review your current plan allowances and upgrade when your team needs more capacity.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-50 shadow-2xl shadow-emerald-500/10 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
              Current Plan
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tighter capitalize">
              {user?.plan ?? 'basic'} Plan
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              {user?.periodEnd
                ? `Renews ${new Date(user.periodEnd).toLocaleDateString('id-ID')} · IDR billing`
                : 'Monthly billing · IDR'}
            </p>
          </div>

          <Link
            href="/pricing"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 whitespace-nowrap shrink-0"
          >
            Compare plans
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Active projects</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {projectsUsed} / {projectsMax}
              </span>
            </div>
            <Progress
              value={calculateUsagePercent(projectsUsed, projectsMax)}
              label="Active projects quota"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Monthly AI revisions</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {revisionsUsed} / {revisionsMax}
              </span>
            </div>
            <Progress
              value={calculateUsagePercent(revisionsUsed, revisionsMax)}
              label="Monthly AI revisions quota"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">AI tokens</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {tokensUsed.toLocaleString('id-ID')} / {tokensLimit.toLocaleString('id-ID')}
              </span>
            </div>
            <Progress
              value={calculateUsagePercent(tokensUsed, tokensLimit)}
              label="Monthly token quota"
            />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tighter text-slate-900">Available plans</h2>
        <div className="mt-5">
          <PricingGrid
            currentPlanId={user?.plan ?? 'basic'}
            onSelectPlan={() => router.push('/pricing')}
          />
        </div>
      </section>
    </DashboardLayout>
  );
}
