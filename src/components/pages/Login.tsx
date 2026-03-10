import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/api';
import { clearAuthSessionStorage } from '../../services/authSession';

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
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<'staff' | 'student'>('student');
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

      const primaryRole = String(userPayload?.role || '').toLowerCase();
      const roleList = Array.isArray(userPayload?.roles)
        ? userPayload.roles
            .map((role: unknown) =>
              typeof role === 'string'
                ? role.toLowerCase()
                : String((role as any)?.code || (role as any)?.name || '').toLowerCase()
            )
            .filter(Boolean)
        : [];

      const hasRole = (role: 'admin' | 'teacher' | 'student') =>
        primaryRole === role || roleList.includes(role);

      const isAdmin = !!userPayload?.isAdmin || hasRole('admin');
      const isTeacher = !!userPayload?.isTeacher || hasRole('teacher');
      const isStudent = hasRole('student') && !!userPayload?.studentId;
      const isStaff = isAdmin || isTeacher;

      if (selectedPortal === 'student' && !isStudent) {
        clearAuthSessionStorage();
        setError('This account is a staff account. Switch to Staff and sign in again.');
        return;
      }

      if (selectedPortal === 'staff' && !isStaff) {
        clearAuthSessionStorage();
        setError('This account is a student account. Switch to Student and sign in again.');
        return;
      }

      onLogin();

      if (isStaff) {
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

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-10 lg:py-14">
          <section className="w-full max-w-[430px]">
            <div className="mx-auto mb-5 w-[220px]">
              <p className="text-center text-4xl font-black tracking-tight text-slate-900">
                ziv<span className="text-blue-600">AI</span>
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl lg:p-10">
              <div className="flex h-full flex-col justify-center">
                <div className="mb-8 space-y-2 text-center">
                  <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
                  <div className="mt-3 flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPortal('staff')}
                      className={`flex-1 rounded-lg px-4 py-1.5 text-center text-sm font-semibold transition ${
                        selectedPortal === 'staff'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPortal('student')}
                      className={`flex-1 rounded-lg px-4 py-1.5 text-center text-sm font-semibold transition ${
                        selectedPortal === 'student'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Student
                    </button>
                  </div>
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
                    <div className="relative mt-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        placeholder="Enter your password"
                        className="block w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-12 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
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
          </section>
        </div>
      </div>
    </div>
  );
};

export default Login;
