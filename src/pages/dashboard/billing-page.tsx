import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { Progress } from '../../components/ui/progress';
import { PricingGrid } from '../../features/billing/components/pricing-grid';
import { calculateUsagePercent } from '../../lib/utils';
import { MOCK_QUOTA } from '../../types';

export function BillingPage() {
  const projectsPct = calculateUsagePercent(MOCK_QUOTA.projectsUsed, MOCK_QUOTA.projectsMax);
  const revisionsPct = calculateUsagePercent(MOCK_QUOTA.revisionsUsed, MOCK_QUOTA.revisionsMax);

  return (
    <DashboardLayout breadcrumb="Billing">
      <div>
        <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Billing &amp; Quota</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Review your current plan allowances and upgrade when your team needs more capacity.
        </p>
      </div>

      {/* Current Plan Dark Card */}
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-50 shadow-2xl shadow-emerald-500/10 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
              Current Plan
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tighter capitalize">
              {MOCK_QUOTA.planId} Plan
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Renews monthly · IDR billing enabled
            </p>
          </div>

          <button
            type="button"
            onClick={() => toast.info('Billing checkout backend pending.')}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 whitespace-nowrap shrink-0"
          >
            Upgrade
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Active projects</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {MOCK_QUOTA.projectsUsed} / {MOCK_QUOTA.projectsMax}
              </span>
            </div>
            <Progress value={projectsPct} label="Active projects quota" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Monthly AI revisions</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {MOCK_QUOTA.revisionsUsed} / {MOCK_QUOTA.revisionsMax}
              </span>
            </div>
            <Progress value={revisionsPct} label="Monthly AI revisions quota" />
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tighter text-slate-900">Available plans</h2>
        <div className="mt-5">
          <PricingGrid
            currentPlanId={MOCK_QUOTA.planId}
            onSelectPlan={(planId) => {
              toast.info(`Plan change to "${planId}" pending payment integration.`);
            }}
          />
        </div>
      </section>
    </DashboardLayout>
  );
}
