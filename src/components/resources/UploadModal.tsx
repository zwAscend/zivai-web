import React, { useCallback, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { 
  X, 
  UploadCloud, 
  FileText, 
  FileImage, 
  FileVideo, 
  File,
  CheckCircle,
  AlertCircle,
  Folder
} from 'lucide-react';

interface Course {
  _id: string;
  id?: string;
  name: string;
  code: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
  selectedCourse: Course | null;
  courses: Course[];
  onCourseSelect: (course: Course) => void;
  onFileSelect?: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  selectedCourse,
  courses,
  onCourseSelect,
  onFileSelect,
  isUploading = false,
  uploadProgress = 0
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    setError(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCourse) return;
    
    try {
      if (onFileSelect) {
        onFileSelect(selectedFile);
      }
      
      // Reset form
      setSelectedFile(null);
      setTags('');
      setError(null);
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload file. Please try again.');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    
    if (ext && imageExts.includes(ext)) {
      return <FileImage className="w-8 h-8 text-green-500" />;
    }
    if (ext && videoExts.includes(ext)) {
      return <FileVideo className="w-8 h-8 text-purple-500" />;
    }
    if (ext && docExts.includes(ext)) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    }
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClose = () => {
    setSelectedFile(null);
    setTags('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  Upload Resource
                </DialogTitle>
                <p className="text-indigo-100 mt-1">
                  Add files to your course library
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              disabled={isUploading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Course Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Select Course</h3>
              <span className="text-red-500">*</span>
            </div>
            
            <select
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              value={selectedCourse?._id || ''}
              onChange={(e) => {
                const course = courses.find(c => c._id === e.target.value);
                if (course) onCourseSelect(course);
              }}
              disabled={isUploading}
              required
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option 
                  key={course._id}
                  value={course._id}
                >
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Upload File</h3>
              <span className="text-red-500">*</span>
            </div>
            
            {!selectedFile ? (
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                
                <div className="space-y-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    dragActive ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <UploadCloud className={`w-8 h-8 ${
                      dragActive ? 'text-indigo-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      {dragActive ? 'Drop your file here' : 'Choose file to upload'}
                    </p>
                    <p className="text-gray-500 mt-1">
                      Drag & drop or click to browse
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      PDF, DOC, XLS, PPT, JPG, PNG, MP4 (max 50MB)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {getFileIcon(selectedFile.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {selectedFile.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    disabled={isUploading}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <label className="text-lg font-semibold text-gray-900">
              Tags (Optional)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas (e.g., homework, chapter1, important)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isUploading}
            />
            <p className="text-sm text-gray-500">
              Tags help organize and search for resources later
            </p>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {selectedFile && selectedCourse ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Ready to upload to {selectedCourse.code}
                </div>
              ) : (
                'Please select a course and file to continue'
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedCourse || isUploading}
                className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;