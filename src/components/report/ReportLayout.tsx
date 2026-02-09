import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ReportLayoutProps {
  children: React.ReactNode;
}

const getActiveAction = (pathname: string) => {
  if (pathname.includes('/reports/student') || pathname.includes('/grading/student')) return 'report-student';
  if (pathname.includes('/reports/curriculum') || pathname.includes('/grading/curriculum')) return 'report-curriculum';
  if (pathname.includes('/reports/term') || pathname.includes('/grading/term')) return 'report-term';
  if (pathname.includes('/reports/analytics') || pathname.includes('/grading/analytics')) return 'report-analytics';
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
        onReportClass={() => navigate('/reports/class')}
        onReportStudent={() => navigate('/reports/student')}
        onReportCurriculum={() => navigate('/reports/curriculum')}
        onReportTerm={() => navigate('/reports/term')}
        onReportAnalytics={() => navigate('/reports/analytics')}
        recentUploads={[]}
      />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default ReportLayout;
