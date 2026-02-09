import { fetchData } from './http';

export interface ReteachCardDetail {
  id: string;
  subjectId?: string | null;
  subjectName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  title: string;
  issueSummary?: string | null;
  recommendedActions?: string | null;
  priority: string;
  status: string;
  affectedStudentIds: string[];
  affectedStudents: Array<{ id: string; firstName: string; lastName: string }>;
  affectedStudentsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReteachCardSummary {
  id: string;
  subjectId?: string | null;
  subjectName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  title: string;
  issueSummary?: string | null;
  recommendedActions?: string | null;
  priority: string;
  status: string;
  affectedStudentIds: string[];
  affectedStudents: number;
  createdAt?: string;
  updatedAt?: string;
}

export const reteachCardService = {
  list: async (params?: {
    subjectId?: string;
    topicId?: string;
    priority?: string;
    status?: string;
  }): Promise<ReteachCardSummary[]> => {
    const searchParams = new URLSearchParams();
    if (params?.subjectId) searchParams.set('subjectId', params.subjectId);
    if (params?.topicId) searchParams.set('topicId', params.topicId);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return fetchData<ReteachCardSummary[]>(`/reteach-cards${query ? `?${query}` : ''}`);
  },
  getDetail: async (id: string): Promise<ReteachCardDetail> => {
    if (!id || id === 'undefined') {
      throw new Error('Re-teach card id is required');
    }
    return fetchData<ReteachCardDetail>(`/reteach-cards/${id}`);
  },
};
