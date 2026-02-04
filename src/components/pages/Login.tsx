// src/components/pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authService } from '../../services/api';

// Zod schema for validation
const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  studentId: z.string().min(1, 'Student ID must be at least 1 character').optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword !== undefined) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof userSchema>;

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, reset, clearErrors } = useForm<UserFormData>();

  const onSubmit = async (data: UserFormData) => {
    setError('');
    setLoading(true);

    try {
      let user;
      if (isLogin) {
        user = await authService.login(data.email, data.password);
      } else {
        if (!data.firstName || !data.lastName || !data.confirmPassword) {
          setError('Please fill in all registration fields.');
          setLoading(false);
          return;
        }

        if (data.password !== data.confirmPassword) {
          setError("Passwords don't match.");
          setLoading(false);
          return;
        }

        const registrationData: Partial<UserFormData> & { studentId?: string } = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        };

        if (data.studentId) registrationData.studentId = data.studentId;

        // Use centralized authService so API_URL and error handling are consistent
        user = await authService.register(registrationData);
      }

      const userPayload: any = (user as any)?.user ?? user;
      if ((user as any)?.token) {
        localStorage.setItem('token', (user as any).token);
      }
      if (userPayload) {
        localStorage.setItem('user', JSON.stringify(userPayload));
      }
      onLogin();

      // Immediately navigate based on the returned user to avoid relying on global routing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storedUser = userPayload as any;
      const isAdmin = !!storedUser?.isAdmin;
      const isTeacher = !!storedUser?.isTeacher;
      const isStudent = storedUser?.role === 'student' && !!storedUser?.studentId;

      if (isAdmin || isTeacher) {
        navigate('/dashboard', { replace: true });
      } else if (isStudent) {
        navigate('/student/dashboard', { replace: true });
      } else {
        // fallback to main dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
  let msg = 'An error occurred. Please try again.';
  if (err instanceof Error) msg = err.message;
  setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    reset();
    clearErrors();
  };

  return (
    <div className="min-h-screen bg-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-8">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  {...register('firstName')}
                  placeholder="Enter your first name"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  {...register('lastName')}
                  placeholder="Enter your last name"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              {...register('email')}
              placeholder="Enter your student email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Optional Student ID for student registration */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Student ID</label>
              <input
                type="text"
                {...register('studentId')}
                placeholder="Enter your student ID"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.studentId && (
                <p className="mt-1 text-sm text-red-600">{errors.studentId.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              {...register('password')}
              placeholder="Enter your password"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                {...register('confirmPassword')}
                placeholder="Enter your password again"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-md py-2 px-4 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? (isLogin ? 'Signing In...' : 'Registering...') : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={toggleMode}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
