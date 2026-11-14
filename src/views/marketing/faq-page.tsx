'use client';

import { cn } from '../../lib/utils';
import { FULL_FAQ_ITEMS } from '../../features/marketing/mock';

export function FaqPage() {
  const [category, setCategory] = useState<keyof typeof FULL_FAQ_ITEMS>('All');

  const filtered =
    category === 'All'
      ? FULL_FAQ_ITEMS
      : FULL_FAQ_ITEMS.filter((item) => item.category === category);

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div>
            <h2 className="text-2xl font-bold tracking-tighter text-slate-900">Frequently Asked Questions</h2>

            <div className="mt-6 space-y-3">
              {FULL_FAQ_ITEMS.map((item) => (
                <div key={item.id} className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 w-full"
                      onClick={() => setCategory(item.category)}
                    >
                      {item.question}
                    </button>
                    <span className="text-xs text-slate-400 capitalize">{item.category}</span>
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-500">
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold tracking-tighter text-slate-900">Categories</h2>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {[
                { label: 'All', value: 'All' },
                { label: 'Billing', value: 'Billing' },
                { label: 'AI', value: 'AI' },
                { label: 'Code', value: 'Code' },
                { label: 'Support', value: 'Support' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                    category === cat.value
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-300 hover:text-slate-600'
                  )}
                  onClick={() => setCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}