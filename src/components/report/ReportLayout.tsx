import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ReportLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = (pathname: string) => {
  if (pathname.includes('/grading/student')) return 'report-student';
  if (pathname.includes('/grading/curriculum')) return 'report-curriculum';
  if (pathname.includes('/grading/term')) return 'report-term';
  return 'report-class';
};

const ReportLayout: React.FC<ReportLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeAction = getActiveAction(location.pathname);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="report"
        activeAction={activeAction}
        onReportClass={() => navigate('/grading/class')}
        onReportStudent={() => navigate('/grading/student')}
        onReportCurriculum={() => navigate('/grading/curriculum')}
        onReportTerm={() => navigate('/grading/term')}
        recentUploads={[]}
      />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default ReportLayout;
