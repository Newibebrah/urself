'use client';

import { useState, type FormEvent } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { useAuth } from '../../features/auth/auth-provider';
import { createClient } from '../../../lib/supabase/client';
import { cn } from '../../lib/utils';

type SettingsTab = 'profile' | 'account';

export function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [name, setName] = useState(user?.name ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) {
      setProfileError('Display name must be at least 2 characters.');
      return;
    }

    setProfileError(null);
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      await refresh();
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account and every project permanently?')) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/account', { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to delete account.');
      }
      await signOut();
      toast.success('Account deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout breadcrumb="Settings">
      <div>
        <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Settings</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Manage your profile and workspace account.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="mt-6 flex items-center gap-1 border-b border-slate-200"
      >
        {(
          [
            { id: 'profile', label: 'Profile' },
            { id: 'account', label: 'Account' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap',
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-xl">
        {activeTab === 'profile' ? (
          <form
            onSubmit={handleSaveProfile}
            noValidate
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label htmlFor="settings-name" className="block text-xs font-medium text-slate-700">
                Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (profileError) setProfileError(null);
                }}
                className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <label htmlFor="settings-email" className="block text-xs font-medium text-slate-700">
                Email Address
              </label>
              <input
                id="settings-email"
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="mt-1.5 h-9 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Email is managed by Supabase Auth and cannot be edited here.
              </p>
            </div>

            {profileError ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                {profileError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        ) : null}

        {activeTab === 'account' ? (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold tracking-tighter text-slate-900">
                Workspace details
              </h2>
              <dl className="mt-4 divide-y divide-slate-100 text-sm">
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-slate-500">User ID</dt>
                  <dd className="truncate font-mono text-xs text-slate-900">{user?.id ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Default Framework</dt>
                  <dd className="font-mono text-xs text-slate-900">react-vite</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Active Plan</dt>
                  <dd className="font-medium capitalize text-emerald-700">{user?.plan ?? 'basic'}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Token usage</dt>
                  <dd className="font-mono text-xs text-slate-900 tabular-nums">
                    {(user?.tokensUsed ?? 0).toLocaleString('id-ID')} /{' '}
                    {(user?.tokensLimit ?? 0).toLocaleString('id-ID')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                Sign out
              </button>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-tighter text-slate-900">
                <ShieldAlert className="h-4 w-4 text-red-600" strokeWidth={1.5} />
                Delete account
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Permanently remove your auth account, projects, files, revisions, and usage records.
              </p>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteAccount()}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {isDeleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
