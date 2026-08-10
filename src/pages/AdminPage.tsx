import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Community, Profile, AbuseReport, ContentCategory } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import {
  Shield, Users, MessageSquare, AlertCircle, Check, X,
  TrendingUp, Activity, Calendar, UserCog, Tag, Plus, Trash2,
} from 'lucide-react';
import { formatDate, timeAgo, classNames } from '../lib/utils';

type Tab = 'overview' | 'communities' | 'users' | 'reports' | 'categories';

export function AdminPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({ users: 0, communities: 0, posts: 0, events: 0, pendingCommunities: 0, openReports: 0 });
  const [pendingCommunities, setPendingCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<(AbuseReport & { reporter?: Profile })[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile || profile.role !== 'admin') { setLoading(false); return; }
    setLoading(true);
    const [
      { count: usersCount }, { count: commsCount }, { count: postsCount },
      { count: eventsCount }, { count: pendingCount }, { count: reportsCount },
      { data: pending }, { data: comms }, { data: u }, { data: r }, { data: cats },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('communities').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('communities').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('abuse_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('communities').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('communities').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('abuse_reports').select('*, reporter:profiles!reporter_id(*)').order('created_at', { ascending: false }),
      supabase.from('content_categories').select('*').order('name', { ascending: true }),
    ]);
    setStats({
      users: usersCount ?? 0, communities: commsCount ?? 0, posts: postsCount ?? 0,
      events: eventsCount ?? 0, pendingCommunities: pendingCount ?? 0, openReports: reportsCount ?? 0,
    });
    setPendingCommunities((pending ?? []) as Community[]);
    setAllCommunities((comms ?? []) as Community[]);
    setUsers((u ?? []) as Profile[]);
    setReports((r ?? []) as any);
    setCategories((cats ?? []) as ContentCategory[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!loading && profile?.role !== 'admin') {
    return <EmptyState icon={<Shield size={28} />} title="Admins only" description="You don't have access to this page." />;
  }
  if (loading) return <PageLoader />;

  const approveCommunity = async (id: string) => {
    const { error } = await supabase.from('communities').update({ status: 'approved' }).eq('id', id);
    if (error) toast('error', error.message);
    else { toast('success', 'Community approved'); setRefreshKey((k) => k + 1); }
  };
  const rejectCommunity = async (id: string) => {
    const { error } = await supabase.from('communities').update({ status: 'rejected' }).eq('id', id);
    if (error) toast('error', error.message);
    else { toast('success', 'Community rejected'); setRefreshKey((k) => k + 1); }
  };

  const setUserRole = async (uid: string, role: 'user' | 'admin') => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', uid);
    if (error) toast('error', error.message);
    else { toast('success', `User role updated to ${role}`); setRefreshKey((k) => k + 1); }
  };

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase.from('abuse_reports').update({ status }).eq('id', id);
    if (error) toast('error', error.message);
    else { toast('success', `Report ${status}`); setRefreshKey((k) => k + 1); }
  };

  const addCategory = async () => {
    if (!newCat.name.trim()) { toast('error', 'Category name is required'); return; }
    const { error } = await supabase.from('content_categories').insert({ name: newCat.name.trim(), description: newCat.description.trim() });
    if (error) { toast('error', error.message.includes('duplicate') ? 'Category already exists' : error.message); return; }
    toast('success', 'Category added');
    setNewCat({ name: '', description: '' });
    setRefreshKey((k) => k + 1);
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('content_categories').delete().eq('id', id);
    if (error) toast('error', error.message);
    else { toast('success', 'Category deleted'); setRefreshKey((k) => k + 1); }
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'communities', label: 'Communities', icon: Users, badge: stats.pendingCommunities },
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'reports', label: 'Reports', icon: AlertCircle, badge: stats.openReports },
    { id: 'categories', label: 'Categories', icon: Tag },
  ];

  const kpis = [
    { label: 'Registered Users', value: stats.users, icon: Users, tone: 'text-forest-600 bg-forest-50' },
    { label: 'Active Communities', value: stats.communities, icon: Shield, tone: 'text-sand-600 bg-sand-100' },
    { label: 'Total Posts', value: stats.posts, icon: MessageSquare, tone: 'text-clay-600 bg-clay-50' },
    { label: 'Total Events', value: stats.events, icon: Calendar, tone: 'text-ink-600 bg-ink-100' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={20} className="text-forest-600" />
        <h1 className="text-2xl font-extrabold text-ink-900">Admin Dashboard</h1>
      </div>
      <p className="text-sm text-ink-500 mb-6">Monitor platform activity, approve communities, manage users, and handle reports.</p>

      <div className="flex gap-1 mb-6 border-b border-ink-100 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px shrink-0',
              tab === t.id ? 'border-forest-600 text-forest-700' : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            <t.icon size={15} />
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="chip text-[10px] bg-clay-100 text-clay-700">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="card p-5">
                <div className={classNames('h-10 w-10 rounded-xl flex items-center justify-center mb-3', k.tone)}>
                  <k.icon size={20} />
                </div>
                <p className="text-2xl font-extrabold text-ink-900">{k.value.toLocaleString()}</p>
                <p className="text-xs text-ink-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-bold text-ink-700 mb-3 flex items-center gap-2">
              <Activity size={16} /> Platform Health
            </h3>
            <div className="space-y-3 text-sm">
              <Row label="Pending community approvals" value={stats.pendingCommunities} tone={stats.pendingCommunities > 0 ? 'text-clay-600' : 'text-forest-600'} />
              <Row label="Open abuse reports" value={stats.openReports} tone={stats.openReports > 0 ? 'text-clay-600' : 'text-forest-600'} />
              <Row label="Avg posts per community" value={stats.communities ? Math.round(stats.posts / stats.communities) : 0} />
              <Row label="Avg events per community" value={stats.communities ? Math.round(stats.events / stats.communities) : 0} />
            </div>
          </div>
        </div>
      )}

      {tab === 'communities' && (
        <div className="space-y-4">
          {pendingCommunities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">Pending Approval</h3>
              <div className="space-y-3">
                {pendingCommunities.map((c) => (
                  <div key={c.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink-900">{c.name}</p>
                        <p className="text-xs text-ink-500 mt-0.5">{c.city_village} · {c.category || 'Uncategorized'}</p>
                        {c.description && <p className="text-sm text-ink-600 mt-2 line-clamp-2">{c.description}</p>}
                        <p className="text-xs text-ink-400 mt-1">Submitted {formatDate(c.created_at)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => approveCommunity(c.id)} className="btn-primary text-sm py-1.5 px-3"><Check size={14} /></button>
                        <button onClick={() => rejectCommunity(c.id)} className="btn-secondary text-sm py-1.5 px-3"><X size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">All Communities</h3>
            <div className="card divide-y divide-ink-100">
              {allCommunities.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center font-bold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-ink-500 truncate">{c.city_village} · {c.member_count} members</p>
                  </div>
                  <span className={classNames(
                    'chip text-[10px]',
                    c.status === 'approved' ? 'bg-forest-50 text-forest-700' :
                    c.status === 'pending' ? 'bg-sand-100 text-sand-700' :
                    'bg-clay-50 text-clay-700',
                  )}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card divide-y divide-ink-100">
          {users.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="No users" />
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-4">
                <Avatar name={u.full_name} src={u.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-sm truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-ink-500 truncate">{u.hometown || 'No hometown'} · Joined {formatDate(u.created_at)}</p>
                </div>
                {u.id !== profile?.id && (
                  <button
                    onClick={() => setUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                    className={classNames(
                      'chip text-xs cursor-pointer',
                      u.role === 'admin' ? 'bg-clay-100 text-clay-700 hover:bg-clay-200' : 'bg-ink-100 text-ink-600 hover:bg-forest-50 hover:text-forest-700',
                    )}
                  >
                    {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
                {u.role === 'admin' && <span className="chip text-[10px] bg-clay-100 text-clay-700"><Shield size={10} /> Admin</span>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <EmptyState icon={<AlertCircle size={28} />} title="No abuse reports" description="Reports filed by users will appear here." />
          ) : (
            reports.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="chip text-[10px] bg-clay-100 text-clay-700">{r.target_type}</span>
                      <span className={classNames(
                        'chip text-[10px]',
                        r.status === 'open' ? 'bg-sand-100 text-sand-700' :
                        r.status === 'resolved' ? 'bg-forest-50 text-forest-700' :
                        'bg-ink-100 text-ink-600',
                      )}>{r.status}</span>
                      <span className="text-xs text-ink-400">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-ink-700 mt-2">{r.reason}</p>
                    <p className="text-xs text-ink-400 mt-1">Reported by {r.reporter?.full_name || 'Unknown'}</p>
                  </div>
                  {r.status === 'open' && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => resolveReport(r.id, 'resolved')} className="btn-primary text-sm py-1.5 px-3">Resolve</button>
                      <button onClick={() => resolveReport(r.id, 'dismissed')} className="btn-secondary text-sm py-1.5 px-3">Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink-700 mb-1 flex items-center gap-2">
              <Plus size={16} /> Add New Category
            </h3>
            <p className="text-xs text-ink-500 mb-4">Categories appear as options when users create communities.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="input flex-1"
                placeholder="Category name (e.g. Sports, Education)"
                value={newCat.name}
                onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
              />
              <input
                className="input flex-1"
                placeholder="Description (optional)"
                value={newCat.description}
                onChange={(e) => setNewCat((c) => ({ ...c, description: e.target.value }))}
              />
              <button onClick={addCategory} className="btn-primary shrink-0"><Plus size={16} /> Add</button>
            </div>
          </div>
          <div className="card divide-y divide-ink-100">
            {categories.length === 0 ? (
              <EmptyState icon={<Tag size={28} />} title="No categories" description="Add categories for users to pick from when creating communities." />
            ) : (
              categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="h-9 w-9 rounded-lg bg-forest-50 text-forest-700 flex items-center justify-center shrink-0">
                    <Tag size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 text-sm">{c.name}</p>
                    {c.description && <p className="text-xs text-ink-500 truncate">{c.description}</p>}
                  </div>
                  <button onClick={() => deleteCategory(c.id)} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone = 'text-ink-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-600">{label}</span>
      <span className={classNames('font-bold', tone)}>{value.toLocaleString()}</span>
    </div>
  );
}
