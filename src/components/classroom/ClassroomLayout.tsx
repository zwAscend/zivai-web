import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ClassroomLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = (tab: string) => {
  switch (tab) {
    case 'development':
      return 'classroom-development';
    default:
      return 'classroom-status';
  }
};

const ClassroomLayout: React.FC<ClassroomLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') || 'status';

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="classroom"
        activeAction={getActiveAction(tab)}
        onClassroomStatus={() => navigate('/classroom?tab=status')}
        onClassroomDevelopment={() => navigate('/classroom?tab=development')}
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

export default ClassroomLayout;
