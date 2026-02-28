import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, BookOpen, Mail, Lock } from 'lucide-react';
import { authService } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50"
      style={{ fontFamily: '"Space Grotesk", "Sora", "Segoe UI", sans-serif' }}
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
          <div className="grid w-full gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Zivai Learning Platform
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-slate-900 lg:text-5xl">
                  Think clearly. Practice deeply. Learn with purpose.
                </h1>
                <p className="text-base text-slate-600 lg:text-lg">
                  Your portal is built to strengthen reasoning, mastery, and collaboration—without doing the work for you.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Guided Practice</p>
                      <p className="text-xs text-slate-500">Focus on gaps, not shortcuts.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">AI Tutor</p>
                      <p className="text-xs text-slate-500">Explain, practice, reflect.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Secure Progress</p>
                      <p className="text-xs text-slate-500">Your learning history stays safe.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Peer Support</p>
                      <p className="text-xs text-slate-500">Learn by teaching others.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
              <div className="mb-8 space-y-2 text-center">
                <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-base text-slate-500">Sign in to continue your learning journey.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-5">
                <label className="block text-sm font-semibold text-slate-700">
                  Email
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 focus-within:ring-2 focus-within:ring-blue-500">
                    <Mail className="h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      className="w-full text-base text-slate-700 focus:outline-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 focus-within:ring-2 focus-within:ring-blue-500">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <input
                      type="password"
                      className="w-full text-base text-slate-700 focus:outline-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </label>

                {error && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
