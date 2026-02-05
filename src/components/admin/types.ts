export type AdminRoleCode = 'admin' | 'teacher' | 'student';

export interface AdminRoleOption {
  label: string;
  value: AdminRoleCode;
}

export const ADMIN_ROLE_OPTIONS: AdminRoleOption[] = [
  { label: 'Admin', value: 'admin' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
];
