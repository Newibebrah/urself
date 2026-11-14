import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { PRICING_PLANS } from '../constants';
import type { PlanId } from '../types';
import { STAGGER_CONTAINER_VARIANTS, STAGGER_ITEM_VARIANTS } from '../../../lib/motion';
import { cn, formatIDR } from '../../../lib/utils';

interface PricingGridProps {
  currentPlanId?: PlanId;
  onSelectPlan?: (planId: PlanId) => void;
}

export function PricingGrid({ currentPlanId, onSelectPlan }: PricingGridProps) {
  return (
    <motion.div
      variants={STAGGER_CONTAINER_VARIANTS}
      initial="initial"
      whileInView="whileInView"
      viewport={{ once: true, amount: 0.15 }}
      className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch"
    >
      {PRICING_PLANS.map((plan) => {
        const isCurrent = currentPlanId === plan.id;
        return (
          <motion.div
            key={plan.id}
            variants={STAGGER_ITEM_VARIANTS}
            className={cn(
              'relative flex flex-col justify-between rounded-xl bg-white p-6 transition-all duration-200',
              plan.highlight
                ? 'border border-emerald-500 ring-1 ring-emerald-500 shadow-2xl shadow-emerald-500/10 hover:-translate-y-2'
                : 'border border-slate-200 shadow-sm hover:-translate-y-0.5 hover:border-emerald-500/50'
            )}
          >
            {plan.highlight ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-lg border border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white whitespace-nowrap shadow-sm">
                Most Popular
              </div>
            ) : null}

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold tracking-tighter text-slate-900">{plan.name}</h3>
                <span className="shrink-0 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  {plan.projectsLimit} proj · {plan.revisionsLimit} rev
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{plan.tagline}</p>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-b border-slate-200 pb-6">
                <span className="text-2xl font-bold tracking-tighter text-slate-900 tabular-nums whitespace-nowrap">
                  {formatIDR(plan.price)}
                </span>
                <span className="text-xs text-slate-500 whitespace-nowrap sm:text-sm">/{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-500">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.75} />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              {onSelectPlan ? (
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => onSelectPlan(plan.id)}
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-all active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                    isCurrent
                      ? 'border border-slate-200 bg-slate-100 text-slate-500 cursor-default active:scale-100'
                      : plan.highlight
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-emerald-500/40'
                  )}
                >
                  {isCurrent ? 'Current Plan' : plan.cta}
                </button>
              ) : (
                <Link
                  to={`/register?plan=${plan.id}`}
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-all active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                    plan.highlight
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-emerald-500/40'
                  )}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
