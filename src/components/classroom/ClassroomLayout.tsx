import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../resources/Sidebar';

interface ClassroomLayoutProps {
  children: React.ReactNode;
  showStudentProfileTab?: boolean;
  classroomWorkspaceNav?: boolean;
  activeClassroomAction?: string;
  onClassroomMySubjects?: () => void;
  onClassroomSubject?: () => void;
  onClassroomStatus?: () => void;
}

const ClassroomLayout: React.FC<ClassroomLayoutProps> = ({
  children,
  showStudentProfileTab = true,
  classroomWorkspaceNav = false,
  activeClassroomAction,
  onClassroomMySubjects,
  onClassroomSubject,
  onClassroomStatus,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveAction = () => {
    if (activeClassroomAction) return activeClassroomAction;
    if (location.pathname.startsWith('/students/profile')) return 'students-profile';
    return 'classroom-status';
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="classroom"
        classroomWorkspaceNav={classroomWorkspaceNav}
        showClassroomStudentProfile={showStudentProfileTab}
        activeAction={getActiveAction()}
        onClassroomStatus={onClassroomStatus || (() => navigate('/classroom'))}
        onClassroomMySubjects={onClassroomMySubjects}
        onClassroomSubject={onClassroomSubject}
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
