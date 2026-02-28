import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ClassroomLayoutProps {
  children: React.ReactNode;
  showStudentProfileTab?: boolean;
}

const ClassroomLayout: React.FC<ClassroomLayoutProps> = ({ children, showStudentProfileTab = true }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveAction = () => {
    if (location.pathname.startsWith('/students/profile')) return 'students-profile';
    return 'classroom-status';
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="classroom"
        showClassroomStudentProfile={showStudentProfileTab}
        activeAction={getActiveAction()}
        onClassroomStatus={() => navigate('/classroom')}
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
