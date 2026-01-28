import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Subject {
  id: string;
  _id?: string;
  code: string;
  name: string;
}

interface AuthContextType {
  selectedSubject: Subject | null;
  setSelectedSubject: (subject: Subject | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  return (
    <AuthContext.Provider value={{ selectedSubject, setSelectedSubject }}>
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
