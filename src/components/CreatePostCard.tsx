import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { ImagePlus, Megaphone, Loader2, X } from 'lucide-react';
import { Avatar } from './Avatar';

interface Props {
  communityId: string;
  onPosted: () => void;
}

export function CreatePostCard({ communityId, onPosted }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [type, setType] = useState<'post' | 'announcement'>('post');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const submit = async () => {
    if (!content.trim() && !imageUrl) return;
    setLoading(true);
    const { error } = await supabase.from('posts').insert({
      community_id: communityId,
      content: content.trim(),
      image_url: imageUrl.trim(),
      type,
    });
    if (error) toast('error', error.message);
    else {
      toast('success', type === 'announcement' ? 'Announcement posted' : 'Post shared');
      setContent('');
      setImageUrl('');
      setType('post');
      setExpanded(false);
      onPosted();
    }
    setLoading(false);
  };

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="md" />
        <div className="flex-1">
          <textarea
            className="w-full resize-none bg-transparent text-sm text-ink-900 placeholder-ink-400 focus:outline-none min-h-[44px]"
            placeholder={`Share something with the community…`}
            value={content}
            onChange={(e) => { setContent(e.target.value); setExpanded(true); }}
            onFocus={() => setExpanded(true)}
          />
          {expanded && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setType(type === 'post' ? 'announcement' : 'post')}
                  className={`chip text-xs transition-colors ${
                    type === 'announcement'
                      ? 'bg-clay-100 text-clay-700 border border-clay-300'
                      : 'bg-ink-100 text-ink-600 border border-transparent'
                  }`}
                >
                  <Megaphone size={12} />
                  {type === 'announcement' ? 'Announcement' : 'Regular post'}
                </button>
              </div>
              <div className="mt-2">
                <div className="relative">
                  <ImagePlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input pl-9 text-xs"
                    placeholder="Image URL (optional)…"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  {imageUrl && (
                    <button
                      onClick={() => setImageUrl('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {imageUrl && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-ink-100">
                    <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <button
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-ink-900/60 text-white flex items-center justify-center hover:bg-ink-900/80 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setExpanded(false); setContent(''); setImageUrl(''); }} className="btn-ghost text-sm">
                  Cancel
                </button>
                <button onClick={submit} disabled={loading || (!content.trim() && !imageUrl)} className="btn-primary text-sm">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Share'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
