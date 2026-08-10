import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { ArrowLeft, MapPin, Users, AlignLeft, BookOpen, Tag } from 'lucide-react';
import { Spinner } from '../components/Feedback';

const CATEGORIES = ['City', 'Village', 'Neighbourhood', 'Diaspora', 'Culture', 'Other'];

export function CreateCommunityPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city_village: '',
    description: '',
    category: '',
    rules: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .insert({ ...form })
      .select()
      .maybeSingle();
    if (error) {
      toast('error', error.message);
      setLoading(false);
      return;
    }
    // Auto-join as moderator
    if (data) {
      await supabase.from('community_members').insert({
        community_id: data.id,
        role: 'moderator',
        status: 'approved',
      });
      await supabase
        .from('communities')
        .update({ member_count: 1 })
        .eq('id', data.id);
    }
    toast('success', 'Community submitted for approval! You will be notified once approved.');
    navigate('/communities');
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/communities')}
        className="btn-ghost mb-4 -ml-2"
      >
        <ArrowLeft size={16} />
        Back to Communities
      </button>

      <div className="card p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900">Create a Community</h1>
          <p className="text-sm text-ink-500 mt-1">
            Start a space for your city, village, or hometown. A platform admin will review and approve it.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label" htmlFor="name">
              <Users size={14} className="inline mr-1" />
              Community name *
            </label>
            <input id="name" className="input" placeholder="e.g. Kochi Connections, Malnad Village Circle" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="city_village">
                <MapPin size={14} className="inline mr-1" />
                City / Village *
              </label>
              <input id="city_village" className="input" placeholder="Kochi, Kerala" value={form.city_village} onChange={set('city_village')} required />
            </div>
            <div>
              <label className="label" htmlFor="category">
                <Tag size={14} className="inline mr-1" />
                Category
              </label>
              <select id="category" className="input" value={form.category} onChange={set('category')}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">
              <AlignLeft size={14} className="inline mr-1" />
              Description
            </label>
            <textarea
              id="description"
              className="input min-h-[100px] resize-y"
              placeholder="Describe who this community is for and what you'll share here…"
              value={form.description}
              onChange={set('description')}
            />
          </div>

          <div>
            <label className="label" htmlFor="rules">
              <BookOpen size={14} className="inline mr-1" />
              Community rules (optional)
            </label>
            <textarea
              id="rules"
              className="input min-h-[80px] resize-y"
              placeholder="1. Be respectful&#10;2. Share only local content&#10;3. No spam"
              value={form.rules}
              onChange={set('rules')}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Spinner size={16} /> : 'Submit for approval'}
            </button>
            <button type="button" onClick={() => navigate('/communities')} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
