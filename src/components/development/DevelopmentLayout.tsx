import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface DevelopmentLayoutProps {
  children: React.ReactNode;
  studentId?: string;
}

const getActiveAction = (pathname: string, studentId?: string) => {
  if (studentId) return 'development-student';
  if (pathname.includes('/development/plans')) return 'development-students';
  if (pathname.includes('/development/reteach')) return 'development-reteach';
  if (pathname.includes('/development/practice')) return 'development-practice';
  return 'development-profile';
};

const DevelopmentLayout: React.FC<DevelopmentLayoutProps> = ({ children, studentId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeAction = getActiveAction(location.pathname, studentId);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="development"
        activeAction={activeAction}
        onDevelopmentProfile={() => navigate('/development/profile')}
        onDevelopmentStudents={() => navigate('/development/plans')}
        onDevelopmentReteach={() => navigate('/development/reteach')}
        onDevelopmentPractice={() => navigate('/development/practice')}
        onDevelopmentStudent={studentId ? () => navigate(`/development/${studentId}`) : undefined}
        recentUploads={[]}
      />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default DevelopmentLayout;
