import React from 'react';
import { useParams } from 'react-router-dom';
import DevelopmentView from '@/components/classroom/DevelopmentView';

const DevelopmentPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  if (!studentId) {
    return <div>No student selected for development view.</div>;
  }

  return (
    <div>
      <DevelopmentView studentId={studentId} />
    </div>
  );
};

export default DevelopmentPage;
