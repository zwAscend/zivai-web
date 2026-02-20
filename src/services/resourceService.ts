import { fetchData } from './http';

export interface ResourceItem {
  id: string;
  name: string;
  originalName?: string;
  mimeType?: string;
  type?: string;
  size?: number;
  url?: string;
  key?: string;
  path?: string;
  downloads?: number;
  status?: string;
  tags?: string[];
  contentType?: string;
  contentBody?: string;
  publishAt?: string;
  subject?: string;
  topicIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const resourceService = {
  listBySubject: async (subjectId: string): Promise<ResourceItem[]> => {
    if (!subjectId || subjectId === 'all') return [];
    return fetchData<ResourceItem[]>(`/resources/subject/${subjectId}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  listByTopic: async (topicId: string): Promise<ResourceItem[]> => {
    if (!topicId) return [];
    return fetchData<ResourceItem[]>(`/resources/topic/${topicId}`, { cacheTtlMs: 5 * 60 * 1000 });
  },
};
