import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface StudentsLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = (pathname: string) => {
  if (pathname.includes('/students/profile')) return 'students-profile';
  return 'students-directory';
};

const StudentsLayout: React.FC<StudentsLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="students"
        activeAction={getActiveAction(location.pathname)}
        onStudentsDirectory={() => navigate('/students')}
        onStudentsProfile={() => navigate('/students/profile')}
        recentUploads={[]}
      />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default StudentsLayout;
