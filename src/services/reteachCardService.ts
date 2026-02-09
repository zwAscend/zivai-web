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

export const reteachCardService = {
  getDetail: async (id: string): Promise<ReteachCardDetail> => {
    if (!id || id === 'undefined') {
      throw new Error('Re-teach card id is required');
    }
    return fetchData<ReteachCardDetail>(`/reteach-cards/${id}`);
  },
};
