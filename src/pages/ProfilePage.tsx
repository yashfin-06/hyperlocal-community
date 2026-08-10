import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Community, CommunityMember } from '../types';
import { Avatar } from '../components/Avatar';
import { Spinner, EmptyState } from '../components/Feedback';
import { MapPin, Edit3, Save, Users, Shield } from 'lucide-react';
import { formatDate } from '../lib/utils';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    hometown: profile?.hometown ?? '',
    current_city: profile?.current_city ?? '',
    bio: profile?.bio ?? '',
    avatar_url: profile?.avatar_url ?? '',
  });
  const [myCommunities, setMyCommunities] = useState<(CommunityMember & { community?: Community })[]>([]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name,
      hometown: profile.hometown,
      current_city: profile.current_city,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
    });
    supabase
      .from('community_members')
      .select('*, community:communities(*)')
      .eq('user_id', profile.id)
      .eq('status', 'approved')
      .then(({ data }) => setMyCommunities((data ?? []) as any));
  }, [profile]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        hometown: form.hometown,
        current_city: form.current_city,
        bio: form.bio,
        avatar_url: form.avatar_url,
      })
      .eq('id', profile!.id);
    if (error) toast('error', error.message);
    else {
      toast('success', 'Profile updated');
      setEditing(false);
      await refreshProfile();
    }
    setSaving(false);
  };

  if (!profile) return <EmptyState icon={<Users size={28} />} title="Profile not found" />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-br from-forest-600 to-forest-800 relative">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.4) 0, transparent 40%)' }} />
        </div>
        <div className="px-6 pb-6 -mt-12">
          <div className="flex items-end justify-between">
            <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" className="ring-4 ring-white" />
            <button onClick={() => setEditing((e) => !e)} className="btn-secondary text-sm">
              <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {!editing ? (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-ink-900">{profile.full_name || 'Member'}</h1>
                {profile.role === 'admin' && <span className="chip bg-clay-100 text-clay-700"><Shield size={11} /> Admin</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-500">
                {profile.hometown && <span className="flex items-center gap-1"><MapPin size={11} /> From {profile.hometown}</span>}
                {profile.current_city && <span className="flex items-center gap-1"><MapPin size={11} /> Lives in {profile.current_city}</span>}
                <span>Joined {formatDate(profile.created_at)}</span>
              </div>
              {profile.bio && <p className="text-sm text-ink-700 mt-3 leading-relaxed">{profile.bio}</p>}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Hometown</label>
                  <input className="input" value={form.hometown} onChange={(e) => setForm((f) => ({ ...f, hometown: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Current city</label>
                  <input className="input" value={form.current_city} onChange={(e) => setForm((f) => ({ ...f, current_city: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Avatar URL</label>
                <input className="input" placeholder="https://…" value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea className="input min-h-[80px] resize-y" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
              </div>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <Spinner size={16} /> : <><Save size={16} /> Save changes</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-ink-700 mb-3 flex items-center gap-2">
          <Users size={16} /> Communities ({myCommunities.length})
        </h2>
        {myCommunities.length === 0 ? (
          <p className="text-sm text-ink-500 card p-6 text-center">You haven't joined any communities yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myCommunities.map((m) => (
              <div key={m.community_id} className="card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center font-bold">
                  {m.community?.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-sm truncate">{m.community?.name}</p>
                  <p className="text-xs text-ink-500 truncate">{m.community?.city_village}</p>
                </div>
                {m.role === 'moderator' && <span className="chip text-[10px] bg-forest-50 text-forest-700"><Shield size={10} /> Mod</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
