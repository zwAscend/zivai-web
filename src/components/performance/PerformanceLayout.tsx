import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface PerformanceLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = (pathname: string) => {
  if (pathname.includes('/performance/student')) return 'performance-student';
  return 'performance-overview';
};

const PerformanceLayout: React.FC<PerformanceLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeAction = getActiveAction(location.pathname);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="performance"
        activeAction={activeAction}
        onPerformanceOverview={() => navigate('/performance/overview')}
        onPerformanceStudent={() => navigate('/performance/student')}
        recentUploads={[]}
      />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default PerformanceLayout;
