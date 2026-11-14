import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { MOCK_BLOG_POSTS } from '../../features/marketing/mock';
import { STAGGER_CONTAINER_VARIANTS, STAGGER_ITEM_VARIANTS } from '../../lib/motion';

export function BlogListPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Blog</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tighter text-slate-900 md:text-5xl">
                Engineering & design notes
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Architecture decisions behind AI-generated React apps, sandboxed previews, and clean design systems.
              </p>
            </div>
          </div>

          <motion.div
            variants={STAGGER_CONTAINER_VARIANTS}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8"
          >
            {MOCK_BLOG_POSTS.map((post) => (
              <motion.div key={post.slug} variants={STAGGER_ITEM_VARIANTS}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-emerald-950/5">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{post.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.publishedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h2 className="mt-2.5 text-lg font-bold leading-snug tracking-tighter text-slate-900 transition-colors group-hover:text-emerald-700">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{post.excerpt}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
