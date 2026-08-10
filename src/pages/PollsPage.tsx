import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Poll, Community } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { BarChart3, Plus, Trash2, Check } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

export function PollsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: mems } = await supabase.from('community_members').select('community_id').eq('user_id', profile.id).eq('status', 'approved');
    const communityIds = ((mems ?? []) as { community_id: string }[]).map((m) => m.community_id);
    if (communityIds.length === 0) { setPolls([]); setCommunities([]); setLoading(false); return; }
    const [{ data: p }, { data: comms }] = await Promise.all([
      supabase.from('polls').select('*, profile:profiles!user_id(*)').in('community_id', communityIds).order('created_at', { ascending: false }),
      supabase.from('communities').select('*').in('id', communityIds),
    ]);
    const pollList = (p ?? []) as Poll[];
    if (pollList.length) {
      const pollIds = pollList.map((x) => x.id);
      const { data: votes } = await supabase.from('poll_votes').select('poll_id, option_index, user_id').in('poll_id', pollIds);
      const voteMap = new Map<string, number[]>();
      const myVoteMap = new Map<string, number>();
      (votes ?? []).forEach((v: any) => {
        const arr = voteMap.get(v.poll_id) ?? [];
        arr[v.option_index] = (arr[v.option_index] ?? 0) + 1;
        voteMap.set(v.poll_id, arr);
        if (v.user_id === profile.id) myVoteMap.set(v.poll_id, v.option_index);
      });
      pollList.forEach((p) => {
        p.votes = voteMap.get(p.id) ?? new Array(p.options.length).fill(0);
        p.my_vote = myVoteMap.has(p.id) ? myVoteMap.get(p.id)! : null;
        p.total_votes = (p.votes ?? []).reduce((a, b) => a + (b ?? 0), 0);
      });
    }
    setPolls(pollList);
    setCommunities((comms ?? []) as Community[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const vote = async (poll: Poll, optionIndex: number) => {
    if (!profile || poll.my_vote !== null && poll.my_vote !== undefined) return;
    const { error } = await supabase.from('poll_votes').insert({ poll_id: poll.id, option_index: optionIndex });
    if (error) { toast('error', error.message); return; }
    setRefreshKey((k) => k + 1);
  };

  const changeVote = async (poll: Poll, optionIndex: number) => {
    if (!profile) return;
    const { error } = await supabase.from('poll_votes').update({ option_index: optionIndex }).eq('poll_id', poll.id).eq('user_id', profile.id);
    if (error) { toast('error', error.message); return; }
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Polls</h1>
          <p className="text-sm text-ink-500 mt-0.5">Gather your community's opinion on local topics</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Poll</button>
      </div>

      {loading ? <PageLoader /> : polls.length === 0 ? (
        <EmptyState icon={<BarChart3 size={28} />} title="No polls yet" description="Create a poll to gather your community's opinion." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Poll</button>} />
      ) : (
        <div className="space-y-4">
          {polls.map((p) => {
            const hasVoted = p.my_vote !== null && p.my_vote !== undefined;
            const total = p.total_votes ?? 0;
            return (
              <div key={p.id} className="card p-5 animate-fade-up">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center shrink-0">
                    <BarChart3 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-ink-900">{p.question}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ink-500">
                      <Avatar name={p.profile?.full_name ?? ''} src={p.profile?.avatar_url} size="xs" />
                      <span>{p.profile?.full_name || 'Neighbor'} · {timeAgo(p.created_at)}</span>
                      <span>· {total} vote{total !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {p.user_id === profile?.id && (
                    <button onClick={async () => {
                      await supabase.from('polls').delete().eq('id', p.id);
                      toast('success', 'Poll deleted'); setRefreshKey((k) => k + 1);
                    }} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600"><Trash2 size={14} /></button>
                  )}
                </div>
                <div className="space-y-2">
                  {p.options.map((opt, i) => {
                    const count = p.votes?.[i] ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isMyVote = p.my_vote === i;
                    return (
                      <button
                        key={i}
                        onClick={() => hasVoted ? changeVote(p, i) : vote(p, i)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ink-800 flex items-center gap-1.5">
                            {isMyVote && <Check size={13} className="text-forest-600" />}
                            {opt}
                          </span>
                          {hasVoted && <span className="text-xs text-ink-500">{pct}% · {count}</span>}
                        </div>
                        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                          <div
                            className={classNames('h-full rounded-full transition-all duration-500', isMyVote ? 'bg-forest-600' : 'bg-forest-400')}
                            style={{ width: hasVoted ? `${pct}%` : '0%' }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!hasVoted && <p className="text-xs text-ink-400 mt-3">Click an option to vote.</p>}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && communities.length > 0 && (
        <CreatePollModal communities={communities} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

function CreatePollModal({ communities, onClose, onCreated }: { communities: Community[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const submit = async () => {
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) { toast('error', 'Question and at least 2 options are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('polls').insert({
      community_id: communities[0].id,
      question: question.trim(),
      options: validOptions,
    });
    if (error) toast('error', error.message);
    else { toast('success', 'Poll created!'); onCreated(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Poll" size="md" footer={<><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Poll'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Community</label>
          <select className="input" value={communities[0]?.id} disabled>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Question *</label>
          <input className="input" placeholder="e.g. Which date works best for the community cleanup?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div>
          <label className="label">Options *</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => setOptions((o) => o.map((x, j) => j === i ? e.target.value : x))} />
                {options.length > 2 && (
                  <button onClick={() => setOptions((o) => o.filter((_, j) => j !== i))} className="btn-ghost p-2 text-ink-400 hover:text-clay-600">✕</button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button onClick={() => setOptions((o) => [...o, ''])} className="btn-ghost text-sm mt-2 text-forest-700">+ Add option</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
