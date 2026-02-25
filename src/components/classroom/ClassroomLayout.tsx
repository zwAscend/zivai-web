import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ClassroomLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = () => 'classroom-status';

const ClassroomLayout: React.FC<ClassroomLayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="classroom"
        activeAction={getActiveAction()}
        onClassroomStatus={() => navigate('/classroom?tab=status')}
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
