import React from 'react';
import { FileText, Folder, MoreVertical, Upload } from 'lucide-react';

interface SubjectCardProps {
  subject: {
    _id: string;
    name: string;
    code: string;
    resourceCount?: number;
    lastUpdated?: string;
  };
  onClick: () => void;
  onUploadClick: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick, onUploadClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div 
        className="p-6 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{subject.name}</h3>
              <p className="text-gray-500 text-sm">{subject.code}</p>
            </div>
          </div>
          <button 
            className="text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center">
            <FileText className="w-4 h-4 mr-1" />
            <span>{subject.resourceCount || 0} resources</span>
          </div>
          {subject.lastUpdated && (
            <span>Updated {new Date(subject.lastUpdated).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      
      <div className="border-t border-gray-100 p-3 bg-gray-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUploadClick();
          }}
          className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>
    </div>
  );
};

export default SubjectCard;
