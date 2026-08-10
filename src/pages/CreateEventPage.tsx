import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Spinner } from '../components/Feedback';
import { ArrowLeft, Calendar, MapPin, AlignLeft } from 'lucide-react';

export function CreateEventPage({ communityId }: { communityId: string }) {
  const { navigate } = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    event_date: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('events').insert({
      community_id: communityId,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
    });
    if (error) toast('error', error.message);
    else {
      toast('success', 'Event created!');
      navigate(`/communities/${communityId}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => navigate(`/communities/${communityId}`)} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold text-ink-900 mb-1">Create Event</h1>
        <p className="text-sm text-ink-500 mb-6">Organize a gathering, meetup, or activity for your community.</p>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label"><Calendar size={14} className="inline mr-1" /> Event title *</label>
            <input className="input" placeholder="e.g. Annual Hometown Meetup" value={form.title} onChange={set('title')} required />
          </div>
          <div>
            <label className="label"><AlignLeft size={14} className="inline mr-1" /> Description</label>
            <textarea className="input min-h-[90px] resize-y" placeholder="What's this event about?" value={form.description} onChange={set('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><MapPin size={14} className="inline mr-1" /> Location</label>
              <input className="input" placeholder="Town Hall, Kochi" value={form.location} onChange={set('location')} />
            </div>
            <div>
              <label className="label"><Calendar size={14} className="inline mr-1" /> Date & time</label>
              <input type="datetime-local" className="input" value={form.event_date} onChange={set('event_date')} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Spinner size={16} /> : 'Create Event'}
            </button>
            <button type="button" onClick={() => navigate(`/communities/${communityId}`)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
