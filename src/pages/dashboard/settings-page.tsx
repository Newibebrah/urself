import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { Tooltip } from '../../components/ui/tooltip';
import { cn, validateEmail } from '../../lib/utils';
import { MOCK_USER, type ApiKeyItem } from '../../types';

type SettingsTab = 'profile' | 'account' | 'api-keys';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [name, setName] = useState(MOCK_USER.name);
  const [email, setEmail] = useState(MOCK_USER.email);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  const handleSaveProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setProfileError('Display name must be at least 2 characters.');
      return;
    }
    const emailRes = validateEmail(email);
    if (!emailRes.ok) {
      setProfileError(emailRes.error);
      return;
    }
    setProfileError(null);
    toast.info('Profile update backend pending.');
  };

  const handleGenerateKey = () => {
    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: `CLI Token ${apiKeys.length + 1}`,
      prefix: `urs_live_••••••••${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: 'Just now',
      lastUsed: 'Never',
    };
    setApiKeys((prev) => [newKey, ...prev]);
    toast.info('API key backend pending — created local preview token.');
  };

  return (
    <DashboardLayout breadcrumb="Settings">
      <div>
        <h1 className="text-2xl font-bold tracking-tighter text-slate-900">Settings</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Manage your profile, workspace defaults, and API credentials.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="mt-6 flex items-center gap-1 border-b border-slate-200"
      >
        {(
          [
            { id: 'profile', label: 'Profile' },
            { id: 'account', label: 'Account' },
            { id: 'api-keys', label: 'API Keys' },
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

      {/* Tab Panels */}
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
                onChange={(e) => {
                  setName(e.target.value);
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (profileError) setProfileError(null);
                }}
                className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              />
            </div>

            {profileError ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                {profileError}
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Save changes
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
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">User ID</dt>
                  <dd className="font-mono text-xs text-slate-900">{MOCK_USER.id}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Default Framework</dt>
                  <dd className="font-mono text-xs text-slate-900">react-vite</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Active Plan</dt>
                  <dd className="font-medium capitalize text-emerald-700">{MOCK_USER.plan}</dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-sm font-bold tracking-tighter text-slate-900">
                Delete workspace
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Permanently remove all generated projects and exports from this account.
              </p>
              <button
                type="button"
                onClick={() => toast.info('Account deletion backend pending.')}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-all hover:bg-red-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                Request deletion
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'api-keys' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tighter text-slate-900">API Keys</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Authenticate CLI exports and CI builds.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateKey}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                <span>Generate API Key</span>
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                <KeyRound className="h-10 w-10 text-slate-300" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-bold tracking-tighter text-slate-900">
                  No API keys yet
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                  Generate a key when you want to trigger exports from your terminal.
                </p>
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
                {apiKeys.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{item.prefix}</div>
                    </div>
                    <Tooltip label="Revoke key" side="left">
                      <button
                        type="button"
                        aria-label={`Revoke ${item.name}`}
                        onClick={() => {
                          setApiKeys((prev) => prev.filter((k) => k.id !== item.id));
                          toast.info('Revoked local preview key.');
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
