import React from 'react';
// Removed useSortable and related imports
// import { useSortable } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { FileText, FileImage, FileVideo, MoreVertical, Download } from 'lucide-react';
// Import the Resource type from ResourcesView
import type { Resource } from './ResourcesView';

interface ResourceItemProps {
  resource: Omit<Resource, 'uploadedBy'> & {
    uploadedBy: string | { _id: string; firstName: string; lastName: string };
  };
  viewMode: 'grid' | 'list';
  // Add an onClick handler for the item
  onClick: (resource: Resource) => void;
}

const ResourceItem: React.FC<ResourceItemProps> = ({ resource, viewMode, onClick }) => {
  // Removed useSortable hook and related declarations
  // const {
  //   attributes,
  //   listeners,
  //   setNodeRef,
  //   transform,
  //   transition,
  // } = useSortable({ id: resource.id });

  // Removed style object
  // const style = {
  //   transform: CSS.Transform.toString(transform),
  //   transition,
  // };

  // Cast the resource to the correct type for the onClick handler
  const handleItemClick = () => {
    onClick(resource as Resource);
  };

  const getIcon = () => {
    switch (resource.type) {
      case 'document':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'image':
        return <FileImage className="w-8 h-8 text-green-500" />;
      case 'video':
        return <FileVideo className="w-8 h-8 text-purple-500" />;
      default:
        return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  if (viewMode === 'grid') {
    return (
      <div
        // Removed ref, style, attributes, listeners
        // ref={setNodeRef}
        // style={style}
        // {...attributes}
        // {...listeners}
        className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" // Changed cursor-move to cursor-pointer
        onClick={handleItemClick} // Add onClick handler to the main div
      >
        <div className="flex items-start justify-between mb-4">
          {getIcon()}
          <button
            className="text-gray-400 hover:text-gray-600 z-10" // Add z-10 to make sure the button is clickable over the div's onClick
            onClick={(e) => {
              e.stopPropagation(); // Prevent the parent div's onClick from firing
              // Handle more options click (e.g., open a context menu)
            }}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        <h3 className="font-medium mb-2 truncate">{resource.name}</h3>
        <div className="text-sm text-gray-500 mb-2">
          {format(resource.lastModified, 'MMM d, yyyy')}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{resource.formattedSize || '0 B'}</span>
          <div className="flex items-center text-gray-500">
            <Download className="w-4 h-4 mr-1" />
            {resource.downloads || 0}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      // Removed ref, style, attributes, listeners
      // ref={setNodeRef}
      // style={style}
      // {...attributes}
      // {...listeners}
      className="flex items-center justify-between bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" // Changed cursor-move to cursor-pointer
      onClick={handleItemClick} // Add onClick handler to the main div
    >
      <div className="flex items-center space-x-4">
        {getIcon()}
        <div>
          <h3 className="font-medium">{resource.name}</h3>
          <div className="text-sm text-gray-500">
            {format(resource.lastModified, 'MMM d, yyyy')} • {resource.formattedSize || '0 B'}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {typeof resource.downloads !== 'undefined' && (
          <div className="flex items-center text-gray-500">
            <Download className="w-4 h-4 mr-1" />
            {resource.downloads}
          </div>
        )}
        <button
          className="text-gray-400 hover:text-gray-600 z-10" // Add z-10 and stopPropagation
          onClick={(e) => {
            e.stopPropagation(); // Prevent the parent div's onClick from firing
            // Handle more options click
          }}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ResourceItem;