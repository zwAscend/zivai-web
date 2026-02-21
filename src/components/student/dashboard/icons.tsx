import { BookOpen, Edit, FileText, Video } from 'lucide-react';
import { StepType } from '../../../types';

export const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'document':
      return <FileText className="w-4 h-4" />;
    case 'assignment':
      return <Edit className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    default:
      return <BookOpen className="w-4 h-4" />;
  }
};
