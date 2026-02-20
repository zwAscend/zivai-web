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
        navigate('/student/home', { replace: true });
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

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 lg:py-16">
          <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="flex h-full flex-col justify-center text-center lg:text-left">
              <div className="mb-8 flex justify-center lg:mb-0 lg:justify-start">
                <div className="rounded-2xl px-7 py-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Learning Platform</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                    ziv<span className="text-blue-600">AI</span>
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold text-slate-900 lg:text-5xl">
                  A platform for learners and teachers.
                </h1>
                <p className="text-base text-slate-600 lg:text-lg">
                  Strengthen classroom learning with guided practice, clear insights, and AI support that builds real
                  understanding.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
              <div className="mb-8 space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-base text-slate-500">Sign in to access your learner or teacher workspace.</p>
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
