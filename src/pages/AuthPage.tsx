import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { MapPin, Mail, Lock, User, ArrowRight, Users, Calendar, MessageSquare, ShoppingBag, AlertTriangle, MessageCircle } from 'lucide-react';

type Mode = 'signin' | 'signup';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    hometown: '',
    current_city: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(form.email, form.password);
      if (error) toast('error', error);
      else toast('success', 'Welcome back!');
    } else {
      if (form.password.length < 6) {
        toast('error', 'Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(form.email, form.password, {
        full_name: form.full_name,
        hometown: form.hometown,
        current_city: form.current_city,
      });
      if (error) {
        if (error.includes('weak_password')) {
          toast('error', 'That password is too common. Please choose a stronger one.');
        } else {
          toast('error', error);
        }
      } else {
        toast('success', 'Account created — welcome to Rooted!');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-forest-700 text-white overflow-hidden">
        <img
          src="https://images.pexels.com/photos/1454410/pexels-photo-1454410.jpeg?auto=compress&cs=tinysrgb&w=900"
          alt="Community"
          className="absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(38,71,47,0.85) 0%, rgba(38,71,47,0.6) 100%)',
          }}
        />
        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative max-w-md">
          <h1 className="font-serif text-4xl leading-tight mb-4">
            Where your hometown lives online.
          </h1>
          <p className="text-forest-100 text-lg leading-relaxed">
            Rooted is a hyperlocal space to reconnect with the people, places, and stories of your city or village — wherever you are now.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: Users, text: 'Join or create your hometown community' },
              { icon: MessageSquare, text: 'Share posts, announcements, and stories' },
              { icon: Calendar, text: 'Organize local events and gatherings' },
              { icon: ShoppingBag, text: 'Buy, sell, and trade on the marketplace' },
              { icon: AlertTriangle, text: 'Stay safe with neighborhood alerts' },
              { icon: MessageCircle, text: 'Message your neighbors directly' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-forest-50">
                <div className="h-9 w-9 rounded-lg bg-forest-600/60 flex items-center justify-center">
                  <f.icon size={18} />
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-forest-200">© {new Date().getFullYear()} Rooted. Preserving local identity.</p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-sand-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="md" />
          </div>
          <div className="card p-8">
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === 'signin' ? 'bg-forest-600 text-white' : 'text-ink-500 hover:bg-ink-100'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === 'signup' ? 'bg-forest-600 text-white' : 'text-ink-500 hover:bg-ink-100'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="label" htmlFor="full_name">Full name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      <input id="full_name" className="input pl-10" placeholder="Asha Verma" value={form.full_name} onChange={set('full_name')} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="hometown">Hometown</label>
                      <div className="relative">
                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input id="hometown" className="input pl-10" placeholder="Kochi" value={form.hometown} onChange={set('hometown')} />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="current_city">Current city</label>
                      <div className="relative">
                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input id="current_city" className="input pl-10" placeholder="Bengaluru" value={form.current_city} onChange={set('current_city')} />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="label" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input id="email" type="email" className="input pl-10" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input id="password" type="password" className="input pl-10" placeholder="••••••••" value={form.password} onChange={set('password')} required />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner size={18} /> : <>Continue <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-xs text-ink-400 text-center mt-5">
              {mode === 'signin' ? "New to Rooted? " : "Already have an account? "}
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-forest-700 font-semibold hover:underline"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
