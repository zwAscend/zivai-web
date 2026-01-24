import React from 'react';
import { useParams } from 'react-router-dom';
import DevelopmentView from '@/components/classroom/DevelopmentView';

const DevelopmentPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  if (!studentId) {
    return <div className="p-4">No student selected for development view.</div>;
  }

  return (
    <div className="p-4">
      <DevelopmentView studentId={studentId} />
    </div>
  );
};

export default DevelopmentPage;
