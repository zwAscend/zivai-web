import React from 'react';
import { useParams } from 'react-router-dom';
import DevelopmentView from '@/components/classroom/DevelopmentView';
import DevelopmentLayout from '@/components/development/DevelopmentLayout';

const DevelopmentPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  if (!studentId) {
    return <div>No student selected for development view.</div>;
  }

  return (
    <DevelopmentLayout studentId={studentId}>
      <DevelopmentView studentId={studentId} />
    </DevelopmentLayout>
  );
};

export default DevelopmentPage;
