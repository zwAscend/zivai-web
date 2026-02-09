import { fetchData } from './http';

export interface CurriculumTopicForecast {
  id: string;
  topic: string;
  coveragePercent: number;
  masteryPercent: number;
  laggingStudents: number;
  status: 'on_track' | 'risk' | 'critical';
  priority: 'high' | 'medium' | 'low';
}

export interface CurriculumForecastResponse {
  subjectId: string;
  subjectName: string;
  topics: CurriculumTopicForecast[];
}

export interface TermForecastResponse {
  subjectId: string;
  subjectName: string;
  term: string;
  expectedCoveragePercent: number;
  topics: CurriculumTopicForecast[];
}

export const reportService = {
  getCurriculumForecast: async (subjectId?: string): Promise<CurriculumForecastResponse | null> => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    const query = params.toString();
    const endpoint = query ? `/reports/curriculum?${query}` : '/reports/curriculum';
    return fetchData(endpoint);
  },
  getTermForecast: async (subjectId?: string, term?: string): Promise<TermForecastResponse | null> => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    if (term) params.append('term', term);
    const query = params.toString();
    const endpoint = query ? `/reports/term-forecast?${query}` : '/reports/term-forecast';
    return fetchData(endpoint);
  }
};
