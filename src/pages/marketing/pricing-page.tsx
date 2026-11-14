import { PricingGrid } from '../../features/billing/components/pricing-grid';
import { PRICING_COMPARISON_ROWS } from '../../features/billing/constants';

export function PricingPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Pricing</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl text-balance">
                Simple plans built for shipping
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Transparent monthly pricing in Indonesian Rupiah with full ZIP source ownership on every tier.
              </p>
            </div>
          </div>

          <div className="lg:col-span-9">
            <PricingGrid />
          </div>
        </div>

        <section className="mt-20">
          <h2 className="text-2xl font-bold tracking-tighter text-slate-900">
            Compare plan limits
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Capability</th>
                  <th className="px-5 py-3.5">Basic</th>
                  <th className="px-5 py-3.5 text-emerald-700">Pro</th>
                  <th className="px-5 py-3.5">King</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {PRICING_COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{row.feature}</td>
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">{row.basic}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 tabular-nums">
                      {row.pro}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">{row.king}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
