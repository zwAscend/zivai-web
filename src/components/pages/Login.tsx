import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authService } from '../../services/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(data.email, data.password);
      const userPayload: any = response?.user;

      if (response?.token) {
        localStorage.setItem('token', response.token);
      }
      if (userPayload) {
        localStorage.setItem('user', JSON.stringify(userPayload));
      }

      onLogin();

      const isAdmin = !!userPayload?.isAdmin;
      const isTeacher = !!userPayload?.isTeacher;
      const isStudent = userPayload?.role === 'student' && !!userPayload?.studentId;

      if (isAdmin || isTeacher) {
        navigate('/dashboard', { replace: true });
      } else if (isStudent) {
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      let msg = 'An error occurred. Please try again.';
      if (err instanceof Error) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{ fontFamily: '"Space Grotesk", "Sora", "Segoe UI", sans-serif' }}
    >
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.08),_transparent_55%)]" />
        <div className="pointer-events-none absolute -top-24 -right-28 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
          <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                Zivai Platform
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold text-slate-900 lg:text-5xl">
                  One portal for learners, teachers, and school leaders.
                </h1>
                <p className="text-base text-slate-600 lg:text-lg">
                  Build mastery with guided practice, AI-supported reasoning, and clear progress tracking—without
                  shortcuts.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Critical thinking</p>
                  <p className="text-xs text-slate-500">Explain reasoning, not just answers.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Guided practice</p>
                  <p className="text-xs text-slate-500">Target gaps with retrieval work.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">AI tutor support</p>
                  <p className="text-xs text-slate-500">Clarify, practice, reflect.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Collaboration</p>
                  <p className="text-xs text-slate-500">Learn by teaching peers.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
              <div className="mb-8 space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-base text-slate-500">Sign in to continue your learning journey.</p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="Enter your email"
                    className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    {...register('password')}
                    placeholder="Enter your password"
                    className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
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
