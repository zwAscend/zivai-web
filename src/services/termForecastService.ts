import { fetchData } from './http';

export interface TermForecastPayload {
  classSubjectId?: string;
  subjectId?: string;
  teacherId?: string;
  term: string;
  academicYear: string;
  expectedCoveragePercent: number;
  expectedTopicIds: string[];
  notes?: string;
}

export interface TermForecastRecord {
  id: string;
  term: string;
  academicYear: string;
  expectedCoveragePct: number;
  expectedTopicIds?: string[];
  notes?: string;
  classSubject?: {
    id: string;
    subject?: { id: string; name?: string };
    classEntity?: { id: string; name?: string };
  };
}

export const termForecastService = {
  list: async (subjectId: string, term?: string): Promise<TermForecastRecord[]> => {
    const params = new URLSearchParams({ subjectId });
    if (term) params.append('term', term);
    return fetchData<TermForecastRecord[]>(`/term-forecasts?${params.toString()}`);
  },
  create: async (payload: TermForecastPayload): Promise<TermForecastRecord> => {
    return fetchData<TermForecastRecord>('/term-forecasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update: async (id: string, payload: TermForecastPayload): Promise<TermForecastRecord> => {
    return fetchData<TermForecastRecord>(`/term-forecasts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  delete: async (id: string): Promise<void> => {
    await fetchData<void>(`/term-forecasts/${id}`, { method: 'DELETE' });
  }
};
