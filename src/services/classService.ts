import { fetchData } from './http';

export interface SchoolRef {
  id: string;
  code?: string;
  name?: string;
}

export interface TeacherRef {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ClassItem {
  id: string;
  school: SchoolRef;
  code: string;
  name: string;
  gradeLevel?: string | null;
  academicYear?: string | null;
  homeroomTeacher?: TeacherRef | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClassPayload {
  schoolId: string;
  code: string;
  name: string;
  gradeLevel?: string;
  academicYear?: string;
  homeroomTeacherId?: string;
}

export interface UpdateClassPayload {
  schoolId?: string;
  code?: string;
  name?: string;
  gradeLevel?: string;
  academicYear?: string;
  homeroomTeacherId?: string;
  clearHomeroomTeacher?: boolean;
}

export const classService = {
  getClasses: async (): Promise<ClassItem[]> => {
    return fetchData<ClassItem[]>('/classes');
  },

  getClassById: async (id: string): Promise<ClassItem> => {
    return fetchData<ClassItem>(`/classes/${id}`);
  },

  createClass: async (payload: CreateClassPayload): Promise<ClassItem> => {
    return fetchData<ClassItem>('/classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateClass: async (id: string, payload: UpdateClassPayload): Promise<ClassItem> => {
    return fetchData<ClassItem>(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteClass: async (id: string): Promise<void> => {
    await fetchData<void>(`/classes/${id}`, {
      method: 'DELETE',
    });
  },
};
