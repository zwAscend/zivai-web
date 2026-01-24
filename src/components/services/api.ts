import { Student, ChatMessage, Result, Assessment, User } from '../../types/index';

const API_URL = 'http://localhost:5000/api';

// Helper function for fetch requests
const fetchData = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Something went wrong',
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Authentication services
export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const data = await fetchData('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('token', data.token);
    return data;
  },

  register: async (userData: Partial<User>): Promise<User> => {
    const data = await fetchData('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    localStorage.setItem('token', data.token);
    return data;
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getProfile: async (): Promise<User> => {
    return fetchData('/auth/profile');
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    return fetchData('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  getCurrentUser: (): User | null => {
    const userJson = localStorage.getItem('user');
    if (!userJson) return null;
    try {
      return JSON.parse(userJson) as User;
    } catch (err) {
      console.error('Failed to parse user from localStorage:', err);
      return null;
    }
  },

};

// Student services
export const studentService = {
  getStudents: async (): Promise<Student[]> => {
    return fetchData('/students');
  },

  getStudent: async (id: string): Promise<Student> => {
    return fetchData(`/students/${id}`);
  },

  createStudent: async (studentData: Partial<Student>): Promise<Student> => {
    return fetchData('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  updateStudent: async (id: string, studentData: Partial<Student>): Promise<Student> => {
    return fetchData(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },

  deleteStudent: async (id: string): Promise<{ message: string }> => {
    return fetchData(`/students/${id}`, {
      method: 'DELETE',
    });
  },

  getDevelopment: async (id: string): Promise<any> => {
    return fetchData(`/students/${id}/development`);
  },

  updatePlan: async (id: string, planData: any): Promise<any> => {
    return fetchData(`/students/${id}/plan`, {
      method: 'PUT',
      body: JSON.stringify(planData),
    });
  },
};

// Assessment services
export const assessmentService = {
  getAssessments: async (): Promise<Assessment[]> => {
    return fetchData('/assessments');
  },

  getAssessment: async (id: string): Promise<Assessment> => {
    return fetchData(`/assessments/${id}`);
  },

  createAssessment: async (assessmentData: Partial<Assessment>): Promise<Assessment> => {
    return fetchData('/assessments', {
      method: 'POST',
      body: JSON.stringify(assessmentData),
    });
  },

  updateAssessment: async (id: string, assessmentData: Partial<Assessment>): Promise<Assessment> => {
    return fetchData(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assessmentData),
    });
  },

  deleteAssessment: async (id: string): Promise<{ message: string }> => {
    return fetchData(`/assessments/${id}`, {
      method: 'DELETE',
    });
  },

  getResults: async (id: string): Promise<Result[]> => {
    return fetchData(`/assessments/${id}/results`);
  },

  addResult: async (id: string, resultData: any): Promise<Result> => {
    return fetchData(`/assessments/${id}/results`, {
      method: 'POST',
      body: JSON.stringify(resultData),
    });
  },

  // NEW FUNCTION: Get assessments and results for a specific student
  getStudentAssessmentsAndResults: async (studentId: string): Promise<{ assessment: Assessment, result: Omit<Result, 'student' | 'assessment'> }[]> => {
    return fetchData(`/assessments/student/${studentId}`);
  },
};

// Development services
export const developmentService = {
  getPlans: async (): Promise<any[]> => {
    return fetchData('/development/plans');
  },

  updateAttributes: async (studentId: string, attributes: any): Promise<any> => {
    return fetchData(`/development/attributes/${studentId}`, {
      method: 'POST',
      body: JSON.stringify(attributes),
    });
  },

  assignPlan: async (studentId: string, planData: any): Promise<any> => {
    return fetchData(`/development/plan/${studentId}`, {
      method: 'POST',
      body: JSON.stringify(planData),
    });
  },

  getStats: async (studentId: string): Promise<any> => {
    return fetchData(`/development/stats/${studentId}`);
  },
};

// Chat services
export const chatService = {
  getMessages: async (studentId: string): Promise<ChatMessage[]> => {
    return fetchData(`/chat/messages/${studentId}`);
  },

  sendMessage: async (studentId: string, content: string): Promise<ChatMessage> => {
    return fetchData(`/chat/messages/${studentId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  markAsRead: async (studentId: string): Promise<{ message: string }> => {
    return fetchData(`/chat/read/${studentId}`, {
      method: 'PUT',
    });
  },

  getUnreadCounts: async (): Promise<any[]> => {
    return fetchData('/chat/unread');
  },
};