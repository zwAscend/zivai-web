import { fetchData } from './http';

export interface CurriculumTopic {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  description?: string;
  objectives?: string;
  sequenceIndex?: number | null;
}

export interface CurriculumTopicPayload {
  code: string;
  name: string;
  description?: string;
  objectives?: string;
  sequenceIndex?: number | null;
}

export interface CurriculumTopicResource {
  id: string;
  name: string;
  originalName?: string;
  mimeType?: string;
  type?: string;
  url?: string;
  contentType?: string;
  status?: string;
  publishAt?: string;
  topicIds?: string[];
}

export interface CurriculumTopicWithResources extends CurriculumTopic {
  resources?: CurriculumTopicResource[];
}

export const curriculumService = {
  listTopics: async (subjectId: string): Promise<CurriculumTopic[]> => {
    return fetchData<CurriculumTopic[]>(`/subjects/${subjectId}/topics`, { cacheTtlMs: 10 * 60 * 1000 });
  },

  listTopicsWithResources: async (subjectId: string): Promise<CurriculumTopicWithResources[]> => {
    return fetchData<CurriculumTopicWithResources[]>(
      `/subjects/${subjectId}/topics-with-resources`,
      { cacheTtlMs: 10 * 60 * 1000 }
    );
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
