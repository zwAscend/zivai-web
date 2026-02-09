import { fetchData } from './http';

export interface CurriculumTopic {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  description?: string;
  sequenceIndex?: number | null;
}

export interface CurriculumTopicPayload {
  code: string;
  name: string;
  description?: string;
  sequenceIndex?: number | null;
}

export const curriculumService = {
  listTopics: async (subjectId: string): Promise<CurriculumTopic[]> => {
    return fetchData<CurriculumTopic[]>(`/admin/subjects/${subjectId}/topics`);
  },

  createTopic: async (subjectId: string, payload: CurriculumTopicPayload): Promise<CurriculumTopic> => {
    return fetchData<CurriculumTopic>(`/admin/subjects/${subjectId}/topics`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTopic: async (topicId: string, payload: CurriculumTopicPayload): Promise<CurriculumTopic> => {
    return fetchData<CurriculumTopic>(`/admin/subjects/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTopic: async (topicId: string): Promise<void> => {
    await fetchData<void>(`/admin/subjects/topics/${topicId}`, { method: 'DELETE' });
  },
};
