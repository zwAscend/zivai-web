import { fetchData } from './http';

export interface AdminSummaryRecentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  roles: string[];
  createdAt: string;
}

export interface AdminSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalSubjects: number;
  activeSubjects: number;
  totalClasses: number;
  totalSchools: number;
  totalClassSubjectLinks: number;
  recentUsers: AdminSummaryRecentUser[];
}

export interface AdminEdgeNode {
  id: string;
  deviceId: string;
  status: 'active' | 'inactive' | 'retired' | string;
  lastSeenAt?: string;
  softwareVersion?: string;
  activeDeployments: number;
  pendingOutboxEvents: number;
  failedInboxEvents: number;
  location?: string;
  ipAddress?: string;
  hardwareModel?: string;
  serialNumber?: string;
  comments?: string;
}

export interface RegisterAdminEdgeNodePayload {
  schoolId?: string;
  deviceId: string;
  status?: 'active' | 'inactive' | 'retired';
  lastSeenAt?: string;
  softwareVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAdminEdgeNodePayload {
  deviceId?: string;
  status?: 'active' | 'inactive' | 'retired';
  lastSeenAt?: string;
  softwareVersion?: string;
  metadata?: Record<string, unknown>;
}

export const adminService = {
  getSummary: async (): Promise<AdminSummary> => {
    return fetchData<AdminSummary>('/admin/summary');
  },

  getEdgeNodes: async (): Promise<AdminEdgeNode[]> => {
    return fetchData<AdminEdgeNode[]>('/admin/edge-nodes');
  },

  registerEdgeNode: async (payload: RegisterAdminEdgeNodePayload): Promise<AdminEdgeNode> => {
    return fetchData<AdminEdgeNode>('/admin/edge-nodes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateEdgeNode: async (id: string, payload: UpdateAdminEdgeNodePayload): Promise<AdminEdgeNode> => {
    return fetchData<AdminEdgeNode>(`/admin/edge-nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteEdgeNode: async (id: string): Promise<void> => {
    await fetchData<void>(`/admin/edge-nodes/${id}`, {
      method: 'DELETE',
    });
  },
};
