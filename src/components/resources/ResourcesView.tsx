import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import {
  FileText,
  FileImage,
  FileVideo,
  ChevronRight,
  Upload,
  Search,
  Filter,
  UploadCloud,
  Grid,
  List,
  FilePlus,
  XCircle,
} from 'lucide-react';

import axios from 'axios';
// Removed DndContext and related imports as requested
// import { DndContext, closestCenter, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
// import { arrayMove, SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import ResourceItem from './ResourceItem';
import UploadModal from './UploadModal';
import FilePreviewModal from './FilePreviewModal';

// Define types for our components
interface ViewModeToggleProps {
  currentMode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
}

interface ResourceTypeFilterProps {
  type: string;
  icon: React.ReactNode;
  active: boolean;
  count: number;
  onClick: () => void;
}

// File type detection - Keep this as is for client-side type mapping
const SUPPORTED_TYPES = {
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
} as const;

type ResourceType = 'document' | 'image' | 'video' | 'other';

// User information interface
interface UploadedByUser {
  _id: string;
  firstName: string;
  lastName: string;
  name?: string;
  id?: string;
}

// Base resource interface
export interface Resource {
  id: string;
  _id: string;
  name: string;
  originalName: string;
  mimeType: string;
  type: ResourceType;
  size: number;
  formattedSize: string;
  url: string;
  key: string;
  path?: string;
  lastModified: string;
  uploadDate: string;
  tags: string[];
  uploadedBy: UploadedByUser;
  extension?: string;
  updatedAt?: string;
  downloads?: number;
  course: string;
  createdAt: string;
}

interface ResourcesViewProps {
  classId: string;
  className?: string;
  classCode?: string;
  onBack: () => void;
  onUploadClick?: () => void;
}

const API_URL = 'http://localhost:5000';

const ResourcesView: React.FC<ResourcesViewProps> = ({
  classId,
  className,
  classCode,
  onBack,
  onUploadClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [courseInfo, setCourseInfo] = useState<{ name: string; code: string } | null>(null);
  const [fileCounts, setFileCounts] = useState({
    total: 0,
    documents: 0,
    images: 0,
    videos: 0,
    other: 0
  });
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedResourceForPreview, setSelectedResourceForPreview] = useState<Resource | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);


  const detectFileType = (data: {
    mimeType?: string;
    name?: string;
    type?: ResourceType;
  }): ResourceType => {
    if (data.type && ['document', 'image', 'video', 'other'].includes(data.type)) {
      return data.type;
    }

    const mime = (data.mimeType || '').toLowerCase();
    for (const [mimeKey, resourceType] of Object.entries(SUPPORTED_TYPES)) {
      if (mime.includes(mimeKey)) {
        return resourceType;
      }
    }

    const fileName = data.name || '';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    const extensionMap: Record<string, ResourceType> = {
      'pdf': 'document', 'doc': 'document', 'docx': 'document', 'xls': 'document',
      'xlsx': 'document', 'txt': 'document', 'csv': 'document', 'json': 'document', 'xml': 'document',
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
      'mp4': 'video', 'webm': 'video', 'ogv': 'video', 'mov': 'video'
    };
    return extensionMap[extension] || 'other';
  };

  const formatFileSize = (bytes: number = 0): { size: number; formatted: string } => {
    if (isNaN(bytes) || bytes === 0) return { size: 0, formatted: '0 B' };
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(k)),
      sizes.length - 1
    );
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return { size: bytes, formatted: isNaN(size) ? '0 B' : `${size} ${sizes[i]}` };
  };

  const transformResource = useCallback((data: any): Resource => {
    const size = typeof data.size === 'string'
      ? parseInt(data.size, 10)
      : Number(data.size) || 0;
    const { formatted: formattedSize } = formatFileSize(size);
    const uploadDate = data.createdAt || new Date().toISOString();
    const lastModified = data.updatedAt || data.createdAt || new Date().toISOString();

    let uploadedBy: UploadedByUser = {
      _id: 'unknown',
      firstName: 'Unknown',
      lastName: ''
    };
    if (data.uploadedBy) {
      if (typeof data.uploadedBy === 'string') {
        uploadedBy = { ...uploadedBy, _id: data.uploadedBy };
      } else {
        uploadedBy = {
          _id: data.uploadedBy._id || 'unknown',
          firstName: data.uploadedBy.firstName || 'Unknown',
          lastName: data.uploadedBy.lastName || '',
          name: data.uploadedBy.name,
          id: data.uploadedBy.id
        };
      }
    }

    const fileName = data.originalName || data.name || 'Unnamed File';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    const resourceId = data._id || data.id || `temp-${Date.now()}`;

    return {
      id: resourceId,
      _id: resourceId,
      name: data.name || fileName,
      originalName: fileName,
      mimeType: data.mimeType || 'application/octet-stream',
      type: detectFileType({
        mimeType: data.mimeType,
        type: data.type,
        name: fileName
      }),
      size,
      formattedSize,
      url: data.url,
      key: data.key || resourceId,
      path: data.path,
      lastModified,
      uploadDate,
      tags: Array.isArray(data.tags) ? data.tags : [],
      uploadedBy,
      extension,
      updatedAt: data.updatedAt,
      downloads: data.downloads || 0,
      course: data.course || classId,
      createdAt: data.createdAt || new Date().toISOString(),
    };
  }, [classId]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!classId) {
      setIsLoading(false);
      return;
    }

    if (!token) {
      console.error('No authentication token found');
      setIsLoading(false);
      setError('Authentication required. Please log in.');
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let fetchedCourseInfo = null;
        try {
          const coursesResponse = await axios.get(`${API_URL}/api/courses/teaching`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (Array.isArray(coursesResponse.data)) {
            const currentCourse = coursesResponse.data.find(
              (course: any) => course._id === classId
            );
            if (currentCourse) {
              fetchedCourseInfo = {
                name: currentCourse.name || 'Unnamed Course',
                code: currentCourse.code || ''
              };
            }
          }

          if (!fetchedCourseInfo) {
            const courseResponse = await axios.get(`${API_URL}/api/courses/${classId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (courseResponse.data) {
              fetchedCourseInfo = {
                name: courseResponse.data.name || 'Unnamed Course',
                code: courseResponse.data.code || ''
              };
            }
          }
        } catch (courseError) {
          console.error('Error fetching course info:', courseError);
          fetchedCourseInfo = {
            name: className || 'Course Resources',
            code: classCode || ''
          };
        }
        setCourseInfo(fetchedCourseInfo);

        const resourcesResponse = await axios.get(`${API_URL}/api/resources/course/${classId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const transformedResources: Resource[] = resourcesResponse.data.map(transformResource);
        setResources(transformedResources);

        const counts = {
          total: transformedResources.length,
          documents: transformedResources.filter((r: Resource) => r.type === 'document').length,
          images: transformedResources.filter((r: Resource) => r.type === 'image').length,
          videos: transformedResources.filter((r: Resource) => r.type === 'video').length,
          other: transformedResources.filter((r: Resource) => r.type === 'other').length
        };
        setFileCounts(counts);

      } catch (error: any) {
        console.error('Error fetching data:', error);
        setResources([]);
        setCourseInfo(null);
        setError(error.response?.data?.message || 'Failed to load resources.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [classId, transformResource, className, classCode]);

  // Removed handleDragEnd as DND is no longer in use
  // const handleDragEnd = (event: DragEndEvent) => {
  //   const { active, over } = event;
  //   if (!over || active.id === over.id) return;
  //   const oldIndex = resources.findIndex(r => r.id === active.id);
  //   const newIndex = resources.findIndex(r => r.id === over.id);
  //   if (oldIndex !== -1 && newIndex !== -1) {
  //     const newResources = arrayMove([...resources], oldIndex, newIndex);
  //     setResources(newResources);
  //   }
  // };

  const filteredResources = React.useMemo(() => {
    if (!resources || !resources.length) return [];

    const query = searchQuery.toLowerCase().trim();
    const filterType = activeFilter.toLowerCase();

    let tempResources = [...resources];

    if (activeFilter !== 'All') {
      tempResources = tempResources.filter((resource: Resource) => resource.type === filterType);
    }

    if (query) {
      tempResources = tempResources.filter((resource: Resource) => {
        const matchesName = resource.name?.toLowerCase().includes(query);
        const matchesOriginalName = resource.originalName?.toLowerCase().includes(query);
        const matchesMimeType = resource.mimeType?.toLowerCase().includes(query);
        const matchesTags = resource.tags?.some(tag =>
          tag?.toLowerCase().includes(query)
        );
        return matchesName || matchesOriginalName || matchesMimeType || matchesTags || false;
      });
    }

    return tempResources.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [resources, searchQuery, activeFilter]);


  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', classId);

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/resources/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(progress);
          }
        }
      );

      const newResource = transformResource(response.data.resource);
      setResources(prevResources => [newResource, ...prevResources]);

      setFileCounts(prevCounts => {
        const newCounts = { ...prevCounts, total: prevCounts.total + 1 };
        switch (newResource.type) {
          case 'document': newCounts.documents++; break;
          case 'image': newCounts.images++; break;
          case 'video': newCounts.videos++; break;
          default: newCounts.other++; break;
        }
        return newCounts;
      });

      setShowUploadModal(false);

    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.response?.data?.message || 'Failed to upload resource. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleResourceClick = useCallback(async (resource: Resource) => {
    setSelectedResourceForPreview(resource);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/resources/download/${resource._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPreviewUrl(response.data.url);
      setPreviewLoading(false);
    } catch (error: any) {
      console.error('Error fetching preview URL:', error);
      setPreviewError(error.response?.data?.message || 'Failed to load preview.');
      setPreviewLoading(false);
    }
  }, []);

  const formatDisplayName = () => {
    const name = courseInfo?.name || className || (classId ? `Course ${classId.substring(0, 6)}` : 'Course Resources');
    const code = courseInfo?.code || classCode || '';

    if (name && code) {
      return `${name} - ${code}`;
    }
    return name;
  };

  const displayName = formatDisplayName();

  return (
    <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
      <div className="p-6 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                aria-label="Back to dashboard"
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <h1 className="text-2xl font-bold">
                {displayName}
              </h1>
            </div>
            {fileCounts.total > 0 && (
              <p className="text-sm text-gray-500 ml-8">
                {fileCounts.total} {fileCounts.total === 1 ? 'resource' : 'resources'}
                {fileCounts.documents > 0 && ` • ${fileCounts.documents} documents`}
                {fileCounts.images > 0 && ` • ${fileCounts.images} images`}
                {fileCounts.videos > 0 && ` • ${fileCounts.videos} videos`}
                {fileCounts.other > 0 && ` • ${fileCounts.other} others`}
              </p>
            )}
          </div>

          <button
            onClick={handleUploadClick}
            className="btn-primary flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Resource
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in this class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              aria-label="Search resources"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-600 hover:text-gray-900">
              <Filter className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-300 mx-1" />
            <ViewModeToggle
              currentMode={viewMode}
              onChange={setViewMode}
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-b bg-gray-50 flex gap-4 overflow-x-auto">
        {['All', 'Documents', 'Images', 'Videos', 'Other'].map((type) => (
          <ResourceTypeFilter
            key={type}
            type={type}
            icon={getIconForType(type)}
            active={type === activeFilter}
            count={type === 'All' ? fileCounts.total :
              type === 'Documents' ? fileCounts.documents :
                type === 'Images' ? fileCounts.images :
                  type === 'Videos' ? fileCounts.videos :
                    fileCounts.other}
            onClick={() => setActiveFilter(type)}
          />
        ))}
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center" role="alert">
            <XCircle className="w-5 h-5 mr-2" />
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <XCircle className="fill-current h-6 w-6 text-red-500" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : resources.length === 0 && !searchQuery && activeFilter === 'All' ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No resources yet</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Upload your first resource to get started. You can upload documents, images, or videos.
            </p>
            <button
              onClick={handleUploadClick}
              className="btn-primary flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Resource
            </button>
          </div>
        ) : filteredResources.length === 0 && (searchQuery || activeFilter !== 'All') ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matching resources found</h3>
            <p className="text-gray-500 max-w-md">
              Try adjusting your search query or filters.
            </p>
          </div>
        ) : (
          // Removed DndContext and SortableResources wrapper
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredResources.map(resource => (
                <ResourceItem
                  key={resource.id}
                  resource={resource}
                  viewMode={viewMode}
                  onClick={handleResourceClick}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResources.map(resource => (
                <ResourceItem
                  key={resource.id}
                  resource={resource}
                  viewMode={viewMode}
                  onClick={handleResourceClick}
                />
              ))}
            </div>
          )
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onFileSelect={handleFileUpload}
          courses={courseInfo ? [{
            _id: classId || '',
            id: classId || '',
            name: courseInfo.name,
            code: courseInfo.code
          }] : []}
          selectedCourse={courseInfo ? {
            _id: classId || '',
            id: classId || '',
            name: courseInfo.name,
            code: courseInfo.code
          } : null}
          onCourseSelect={(course) => {
            console.log('Selected course:', course);
          }}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}

      {showPreviewModal && selectedResourceForPreview && (
        <FilePreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedResourceForPreview(null);
            setPreviewUrl(null);
            setPreviewError(null);
          }}
          resource={selectedResourceForPreview}
          previewUrl={previewUrl}
          isLoading={previewLoading}
          error={previewError}
        />
      )}
    </div>
  );
};

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ currentMode, onChange }) => (
  <div className="flex bg-gray-100 rounded-lg p-1">
    <button
      onClick={() => onChange('grid')}
      className={`p-1 rounded ${currentMode === 'grid' ? 'bg-white shadow' : ''}`}
      aria-label="Grid view"
    >
      <Grid className="w-5 h-5" />
    </button>
    <button
      onClick={() => onChange('list')}
      className={`p-1 rounded ${currentMode === 'list' ? 'bg-white shadow' : ''}`}
      aria-label="List view"
    >
      <List className="w-5 h-5" />
    </button>
  </div>
);

const ResourceTypeFilter: React.FC<ResourceTypeFilterProps> = ({
  type,
  icon,
  active,
  count,
  onClick
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
      active
        ? 'bg-blue-50 text-blue-600 border border-blue-200'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    {React.cloneElement(icon as React.ReactElement, {
      className: `${active ? 'text-blue-500' : 'text-gray-400'} w-4 h-4`
    })}
    <span className="font-medium">{type}</span>
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {count}
    </span>
  </button>
);

const getIconForType = (type: string) => {
  switch (type) {
    case 'Documents': return <FileText className="w-4 h-4 text-blue-500" />;
    case 'Images': return <FileImage className="w-4 h-4 text-green-500" />;
    case 'Videos': return <FileVideo className="w-4 h-4 text-purple-500" />;
    case 'Other': return <FilePlus className="w-4 h-4 text-gray-500" />;
    default: return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

// Removed SortableResources component entirely as it's no longer needed
// interface SortableResourcesProps {
//   resources: Resource[];
//   viewMode: 'grid' | 'list';
//   gridStrategy: any;
//   listStrategy: any;
//   children: ReactNode;
// }

// const SortableResources: React.FC<SortableResourcesProps> = ({
//   resources,
//   viewMode,
//   gridStrategy,
//   listStrategy,
//   children
// }) => {
//   const itemIds = resources
//     .filter((r): r is Resource & { id: string } => Boolean(r.id))
//     .map(r => r.id);

//   const sortableItems = itemIds as unknown as UniqueIdentifier[];

//   return (
//     <SortableContext
//       items={sortableItems}
//       strategy={viewMode === 'grid' ? gridStrategy : listStrategy}
//     >
//       {children}
//     </SortableContext>
//   );
// };

export default ResourcesView;