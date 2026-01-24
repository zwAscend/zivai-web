import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Course {
  id: string;
  _id?: string;
  code: string;
  name: string;
}

interface AuthContextType {
  selectedCourse: Course | null;
  setSelectedCourse: (course: Course | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  return (
    <AuthContext.Provider value={{ selectedCourse, setSelectedCourse }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
