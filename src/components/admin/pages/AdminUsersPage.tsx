import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, RefreshCw, Shield, Trash2, UserCog } from 'lucide-react';
import { authService, userService } from '../../../services/api';
import { User } from '../../../types';
import AdminSectionHeader from '../components/AdminSectionHeader';
import { ADMIN_ROLE_OPTIONS, AdminRoleCode } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useToast } from '../../ui/use-toast';
import AdminConfirmDialog from '../components/AdminConfirmDialog';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  username: string;
  password: string;
  role: AdminRoleCode;
  active: boolean;
};

const defaultForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  username: '',
  password: '',
  role: 'student',
  active: true,
};

type RoleLike = string | { code?: string; name?: string };

const normalizeRoles = (roles: unknown): string[] => {
  if (!Array.isArray(roles)) {
    return [];
  }

  return (roles as RoleLike[])
    .map((role) => (typeof role === 'string' ? role : role.code || role.name || ''))
    .filter((role): role is string => Boolean(role));
};

const UserTableSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((__, colIndex) => (
          <div key={colIndex} className="h-9 rounded bg-slate-200 animate-pulse" />
        ))}
      </div>
    ))}
  </div>
);

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRoleCode>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const currentUser = authService.getCurrentUser();
  const isAdmin = !!currentUser?.isAdmin || currentUser?.role === 'admin';

  const filteredUsers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return users
      .filter((user) => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.phoneNumber || '').toLowerCase();
        const roles = normalizeRoles((user as any).roles);
        const active = (user as any).active !== false;

        const matchesSearch =
          !normalizedTerm ||
          fullName.includes(normalizedTerm) ||
          email.includes(normalizedTerm) ||
          phone.includes(normalizedTerm);
        const matchesRole = roleFilter === 'all' || roles.includes(roleFilter);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && active) ||
          (statusFilter === 'inactive' && !active);

        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const openCreateModal = () => {
    setFormMode('create');
    setEditingUserId(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const openEditModal = (user: User) => {
    const roles = normalizeRoles((user as any).roles);
    const userRole = (roles.find((role) => ['admin', 'teacher', 'student'].includes(role)) ||
      'student') as AdminRoleCode;

    setFormMode('edit');
    setEditingUserId(user.id);
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      username: user.username || '',
      password: '',
      role: userRole,
      active: (user as any).active !== false,
    });
    setIsFormOpen(true);
  };

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName || !form.lastName || !form.email || !form.phoneNumber) {
      toast.error('Please fill all required fields.');
      return;
    }

    if (formMode === 'create' && !form.password) {
      toast.error('Password is required for new users.');
      return;
    }

    setSaving(true);
    try {
      if (formMode === 'create') {
        await userService.createUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phoneNumber: form.phoneNumber.trim(),
          username: form.username.trim() || undefined,
          password: form.password,
          roleCodes: [form.role],
          active: form.active,
        });
        toast.success('User created successfully.');
      } else if (editingUserId) {
        await userService.updateUser(editingUserId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phoneNumber: form.phoneNumber.trim(),
          username: form.username.trim() || undefined,
          password: form.password.trim() || undefined,
          roleCodes: [form.role],
          active: form.active,
        });
        toast.success('User updated successfully.');
      }

      setIsFormOpen(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const askDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const removeUser = async () => {
    if (!userToDelete) {
      return;
    }

    setSaving(true);
    try {
      await userService.deleteUser(userToDelete.id);
      toast.success('User deleted successfully.');
      setUserToDelete(null);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mt-4">
        <div className="flex items-center gap-2 text-red-600 font-semibold mb-2">
          <AlertCircle className="w-5 h-5" />
          Access Denied
        </div>
        <p className="text-gray-600">This page is available to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="User Management"
        description="View, filter, create, update, and deactivate accounts."
        icon={Shield}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">User Records</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md"
            >
              <Plus className="w-4 h-4" />
              Create User
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className="border rounded-md px-3 py-2 md:col-span-2"
            placeholder="Search name, email, or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | AdminRoleCode)}
          >
            <option value="all">All Roles</option>
            {ADMIN_ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <UserTableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Roles</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const roles = normalizeRoles((user as any).roles);
                  return (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || '-'}</td>
                      <td className="py-2 pr-4">{user.email || '-'}</td>
                      <td className="py-2 pr-4">{user.phoneNumber || '-'}</td>
                      <td className="py-2 pr-4">{roles.join(', ') || '-'}</td>
                      <td className="py-2 pr-4">
                        {(user as any).active === false ? (
                          <span className="text-red-600">Inactive</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1 text-xs"
                          >
                            <UserCog className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => askDeleteUser(user)}
                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1 text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Create User' : 'Edit User'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Add a new account and assign a role.'
                : 'Update account details and role assignment.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded-md px-3 py-2"
              placeholder="First name *"
              value={form.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Last name *"
              value={form.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
            />
            <input
              type="email"
              className="border rounded-md px-3 py-2"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Phone number *"
              value={form.phoneNumber}
              onChange={(e) => onChange('phoneNumber', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Username (optional)"
              value={form.username}
              onChange={(e) => onChange('username', e.target.value)}
            />
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              placeholder={formMode === 'create' ? 'Password *' : 'New password (optional)'}
              value={form.password}
              onChange={(e) => onChange('password', e.target.value)}
            />
            <select
              className="border rounded-md px-3 py-2"
              value={form.role}
              onChange={(e) => onChange('role', e.target.value as AdminRoleCode)}
            >
              {ADMIN_ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 px-1 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => onChange('active', e.target.checked)}
              />
              Active user
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-5 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
              >
                {saving ? 'Saving...' : formMode === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!userToDelete}
        title="Delete User"
        description={`Delete user "${userToDelete?.email || ''}"? This performs a soft delete.`}
        confirmLabel="Delete User"
        busy={saving}
        onConfirm={removeUser}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
          }
        }}
      />
    </div>
  );
};

export default AdminUsersPage;
