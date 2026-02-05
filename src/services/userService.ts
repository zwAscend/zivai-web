import { fetchData } from './http';
import { User } from '../types';

export interface CreateUserPayload {
  externalId?: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  username?: string;
  password: string;
  active?: boolean;
  roleCodes: string[];
}

export interface UpdateUserPayload {
  externalId?: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  active?: boolean;
  roleCodes?: string[];
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    return fetchData<User[]>('/users');
  },

  getUserById: async (id: string): Promise<User> => {
    return fetchData<User>(`/users/${id}`);
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    return fetchData<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    return fetchData<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteUser: async (id: string): Promise<void> => {
    await fetchData<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};
