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

export interface UpsertResourcePayload {
  schoolId: string;
  subjectId?: string;
  uploadedBy: string;
  name: string;
  originalName?: string;
  mimeType?: string;
  resType?: string;
  sizeBytes?: number;
  url?: string;
  storageKey?: string;
  storagePath?: string;
  tags?: string[];
  contentType?: string;
  contentBody?: string;
  publishAt?: string | null;
  displayOrder?: number;
  status?: string;
  topicIds?: string[];
}

export interface ListResourceFilters {
  subjectId?: string;
  status?: string;
}

export const resourceService = {
  get: async (resourceId: string): Promise<ResourceItem> => {
    return fetchData<ResourceItem>(`/resources/${resourceId}`);
  },

  list: async (filters: ListResourceFilters = {}): Promise<ResourceItem[]> => {
    const params = new URLSearchParams();
    if (filters.subjectId && filters.subjectId !== 'all') {
      params.set('subjectId', filters.subjectId);
    }
    if (filters.status) {
      params.set('status', filters.status);
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return fetchData<ResourceItem[]>(`/resources${suffix}`, { cacheTtlMs: 60 * 1000 });
  },

  listBySubject: async (subjectId: string): Promise<ResourceItem[]> => {
    if (!subjectId || subjectId === 'all') return [];
    return fetchData<ResourceItem[]>(`/resources/subject/${subjectId}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  listByTopic: async (topicId: string): Promise<ResourceItem[]> => {
    if (!topicId) return [];
    return fetchData<ResourceItem[]>(`/resources/topic/${topicId}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  create: async (payload: UpsertResourcePayload): Promise<ResourceItem> => {
    return fetchData<ResourceItem>('/resources', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: async (resourceId: string, payload: Partial<UpsertResourcePayload>): Promise<ResourceItem> => {
    return fetchData<ResourceItem>(`/resources/${resourceId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: async (resourceId: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/resources/${resourceId}`, {
      method: 'DELETE',
    });
  },

  addTopics: async (resourceId: string, topicIds: string[]): Promise<ResourceItem> => {
    return fetchData<ResourceItem>(`/resources/${resourceId}/topics`, {
      method: 'POST',
      body: JSON.stringify({ topicIds }),
    });
  },

  removeTopic: async (resourceId: string, topicId: string): Promise<ResourceItem> => {
    return fetchData<ResourceItem>(`/resources/${resourceId}/topics/${topicId}`, {
      method: 'DELETE',
    });
  },
};
