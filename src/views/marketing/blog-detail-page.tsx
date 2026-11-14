'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MOCK_BLOG_POSTS } from '../../features/marketing/mock';

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = MOCK_BLOG_POSTS.find((p) => p.slug === slug) ?? MOCK_BLOG_POSTS[0];

  return (
    <article className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-slate-500 transition-all hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          <span>Back to blog</span>
        </Link>

        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{post.publishedAt}</span>
            <span aria-hidden="true">·</span>
            <span>{post.readTime}</span>
            <span aria-hidden="true">·</span>
            <span>By {post.author}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl text-balance">
            {post.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-500">{post.excerpt}</p>
        </header>

        <div className="mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-emerald-950/5">
          <img
            src={post.coverImage}
            alt={post.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mt-10 space-y-6 text-base leading-relaxed text-slate-600">
          {post.content.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-base font-bold tracking-tighter text-slate-900">
              Build your next site by prompt
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Try the interactive workspace with realistic React + Vite templates.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
          >
            Start Building
          </Link>
        </div>
      </div>
    </article>
  );
}
