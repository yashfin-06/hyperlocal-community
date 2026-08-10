import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Alert, Community, AlertUrgency, AlertCategory } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { AlertTriangle, Plus, Trash2, ShieldAlert, Siren, CloudRain, Car, PawPrint } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

const URGENCIES: { value: AlertUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-forest-100 text-forest-700' },
  { value: 'medium', label: 'Medium', color: 'bg-sand-100 text-sand-700' },
  { value: 'high', label: 'High', color: 'bg-clay-100 text-clay-700' },
  { value: 'critical', label: 'Critical', color: 'bg-clay-600 text-white' },
];

const CATEGORIES: { value: AlertCategory; label: string; icon: typeof ShieldAlert }[] = [
  { value: 'crime', label: 'Crime & Safety', icon: ShieldAlert },
  { value: 'hazard', label: 'Hazard', icon: AlertTriangle },
  { value: 'lost_pet', label: 'Lost Pet', icon: PawPrint },
  { value: 'weather', label: 'Weather', icon: CloudRain },
  { value: 'traffic', label: 'Traffic', icon: Car },
  { value: 'general', label: 'General', icon: Siren },
];

export function AlertsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: mems } = await supabase.from('community_members').select('community_id').eq('user_id', profile.id).eq('status', 'approved');
    const communityIds = ((mems ?? []) as { community_id: string }[]).map((m) => m.community_id);
    if (communityIds.length === 0) { setAlerts([]); setCommunities([]); setLoading(false); return; }
    const [{ data: a }, { data: comms }] = await Promise.all([
      supabase.from('alerts').select('*, profile:profiles!user_id(*)').in('community_id', communityIds).order('created_at', { ascending: false }),
      supabase.from('communities').select('*').in('id', communityIds),
    ]);
    setAlerts((a ?? []) as Alert[]);
    setCommunities((comms ?? []) as Community[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Safety Alerts</h1>
          <p className="text-sm text-ink-500 mt-0.5">Urgent neighborhood alerts and announcements</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Alert</button>
      </div>

      {loading ? <PageLoader /> : alerts.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={28} />} title="No active alerts" description="Share a safety alert to keep your neighbors informed." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Alert</button>} />
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => {
            const cat = CATEGORIES.find((c) => c.value === a.category);
            const urg = URGENCIES.find((u) => u.value === a.urgency);
            const CatIcon = cat?.icon ?? Siren;
            return (
              <div key={a.id} className={classNames('card p-5 animate-fade-up border-l-4', a.urgency === 'critical' ? 'border-l-clay-600' : a.urgency === 'high' ? 'border-l-clay-500' : a.urgency === 'medium' ? 'border-l-sand-500' : 'border-l-forest-500')}>
                <div className="flex items-start gap-3">
                  <div className={classNames('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', urg?.color ?? 'bg-ink-100 text-ink-600')}>
                    <CatIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-ink-900">{a.title}</h3>
                      {urg && <span className={classNames('chip text-[10px]', urg.color)}>{urg.label}</span>}
                      {cat && <span className="chip text-[10px] bg-ink-100 text-ink-600">{cat.label}</span>}
                    </div>
                    {a.body && <p className="text-sm text-ink-700 mt-2 leading-relaxed whitespace-pre-line">{a.body}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100">
                      <div className="flex items-center gap-2 text-xs text-ink-500">
                        <Avatar name={a.profile?.full_name ?? ''} src={a.profile?.avatar_url} size="xs" />
                        <span>{a.profile?.full_name || 'Neighbor'} · {timeAgo(a.created_at)}</span>
                      </div>
                      {a.user_id === profile?.id && (
                        <button onClick={async () => {
                          await supabase.from('alerts').delete().eq('id', a.id);
                          toast('success', 'Alert removed'); setRefreshKey((k) => k + 1);
                        }} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && communities.length > 0 && (
        <CreateAlertModal communities={communities} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

function CreateAlertModal({ communities, onClose, onCreated }: { communities: Community[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ community_id: communities[0]?.id ?? '', title: '', body: '', urgency: 'medium' as AlertUrgency, category: 'general' as AlertCategory });

  const submit = async () => {
    if (!form.title.trim() || !form.community_id) { toast('error', 'Title and community are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('alerts').insert({
      community_id: form.community_id,
      title: form.title.trim(),
      body: form.body.trim(),
      urgency: form.urgency,
      category: form.category,
    });
    if (error) toast('error', error.message);
    else { toast('success', 'Alert posted!'); onCreated(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Safety Alert" size="md" footer={<><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Posting…' : 'Post Alert'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Community *</label>
          <select className="input" value={form.community_id} onChange={(e) => setForm((f) => ({ ...f, community_id: e.target.value }))}>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Urgency</label>
            <select className="input" value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as AlertUrgency }))}>
              {URGENCIES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AlertCategory }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title *</label>
          <input className="input" placeholder="e.g. Suspicious activity near Main Street" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label">Details</label>
          <textarea className="input min-h-[80px] resize-y" placeholder="Describe what happened, when, and where…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}
