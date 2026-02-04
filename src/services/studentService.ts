import { fetchData } from './http';
import { Student } from '../types';

export const studentService = {
  getStudents: async (subjectId?: string): Promise<Student[]> => {
    const endpoint = subjectId ? `/students?subjectId=${subjectId}` : '/students';
    return fetchData(endpoint);
  },

  getStudent: async (id: string): Promise<Student> => {
    if (!id || id === 'undefined') {
      throw new Error('Student id is required');
    }
    return fetchData<Student>(`/students/${id}`);
  },

  createStudent: async (studentData: Partial<Student>): Promise<Student> => {
    return fetchData<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  updateStudent: async (id: string, studentData: Partial<Student>): Promise<Student> => {
    return fetchData<Student>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },

  deleteStudent(id: string): Promise<{ message: string }> {
    return fetchData(`/students/${id}`, {
      method: 'DELETE',
    });
  }
};
