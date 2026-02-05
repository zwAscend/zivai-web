import { fetchData } from './http';

export interface SchoolItem {
  id: string;
  code: string;
  name: string;
  countryCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const schoolService = {
  getSchools: async (): Promise<SchoolItem[]> => {
    return fetchData<SchoolItem[]>('/schools');
  },
};
