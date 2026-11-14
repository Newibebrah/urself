import { useState } from 'react';
import { Accordion } from '../../components/ui/accordion';
import { FULL_FAQ_ITEMS } from '../../features/marketing/mock';
import { cn } from '../../lib/utils';

const CATEGORIES = ['All', 'Billing', 'AI', 'Code', 'Support'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

export function FaqPage() {
  const [category, setCategory] = useState<CategoryFilter>('All');

  const filtered =
    category === 'All'
      ? FULL_FAQ_ITEMS
      : FULL_FAQ_ITEMS.filter((item) => item.category === category);

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">FAQ</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tighter text-slate-900">
                Questions? Answered.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Clear details on how code generation, live previews, export ownership, and IDR billing work.
              </p>

              <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="FAQ categories">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                      category === cat
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <Accordion
              items={filtered.map((item) => ({
                id: item.id,
                kicker: item.category,
                question: item.question,
                answer: item.answer,
              }))}
              defaultOpenId={filtered[0]?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
