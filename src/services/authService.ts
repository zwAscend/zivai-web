import { fetchData } from './http';
import { User } from '../types';
import {
  clearAuthSessionStorage,
  getActiveUserJson,
  markBrowserSessionActive,
} from './authSession';

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await fetchData<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data?.token) {
      localStorage.setItem('token', data.token);
      markBrowserSessionActive();
    }
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  },

  async register(_userData: Partial<User>): Promise<{ token: string; user: User }> {
    throw new Error('Registration is not enabled yet. Contact your administrator.');
  },

  logout(): void {
    clearAuthSessionStorage();
    window.location.href = '/login';
  },

  getCurrentUser(): User | null {
    const userStr = getActiveUserJson();
    return userStr ? JSON.parse(userStr) : null;
  }
};
