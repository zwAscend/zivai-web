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
  expectedTopicIds?: string[];
  topics: CurriculumTopicForecast[];
}

export interface ClassReportResponse {
  subjectId?: string | null;
  subjectName?: string | null;
  classId?: string | null;
  className?: string | null;
  classAveragePercent: number;
  predictedGrade: string;
  studentCount: number;
  assessmentCount: number;
  gradeDistribution: Record<string, number>;
  masteryGaps: CurriculumTopicForecast[];
}

export interface StudentReportAssessment {
  assessmentId?: string | null;
  assessmentName?: string | null;
  assessmentType?: string | null;
  score?: number | null;
  maxScore?: number | null;
  percent?: number | null;
  submittedAt?: string | null;
}

export interface StudentTopicMastery {
  topicId?: string | null;
  topicName?: string | null;
  masteryPercent: number;
  status: 'on_track' | 'risk' | 'critical';
  priority: 'high' | 'medium' | 'low';
}

export interface StudentReportResponse {
  studentId: string;
  studentName?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  averagePercent: number;
  predictedGrade: string;
  assessmentCount: number;
  assessments: StudentReportAssessment[];
  masteryGaps: StudentTopicMastery[];
}

export const reportService = {
  getCurriculumForecast: async (subjectId?: string): Promise<CurriculumForecastResponse | null> => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    const query = params.toString();
    const endpoint = query ? `/reports/curriculum?${query}` : '/reports/curriculum';
    return fetchData(endpoint);
  },
  getTermForecast: async (
    subjectId?: string,
    term?: string,
    academicYear?: string,
    forecastId?: string
  ): Promise<TermForecastResponse | null> => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    if (term) params.append('term', term);
    if (academicYear) params.append('academicYear', academicYear);
    if (forecastId) params.append('forecastId', forecastId);
    const query = params.toString();
    const endpoint = query ? `/reports/term-forecast?${query}` : '/reports/term-forecast';
    return fetchData(endpoint);
  },
  getClassReport: async (subjectId?: string, classId?: string): Promise<ClassReportResponse | null> => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    if (classId) params.append('classId', classId);
    const query = params.toString();
    const endpoint = query ? `/reports/class-report?${query}` : '/reports/class-report';
    return fetchData(endpoint);
  },
  getStudentReport: async (studentId: string, subjectId?: string): Promise<StudentReportResponse | null> => {
    const params = new URLSearchParams();
    params.append('studentId', studentId);
    if (subjectId) params.append('subjectId', subjectId);
    const endpoint = `/reports/student-report?${params.toString()}`;
    return fetchData(endpoint);
  }
};
