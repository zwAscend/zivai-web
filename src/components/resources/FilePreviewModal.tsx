import React, { forwardRef } from 'react';
import { X, FileText, Download, Loader2, AlertCircle } from 'lucide-react'; // Added Loader2 and AlertCircle for loading/error states
import type { Resource } from './ResourcesView'; // Import the Resource type

// Update FilePreviewModalProps to accept Resource object and loading/error states
interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource | null; // Changed from 'file' to 'resource' and made it nullable
  previewUrl: string | null; // New prop for the actual URL to preview
  isLoading: boolean; // New prop for loading state
  error: string | null; // New prop for error messages
}

const FilePreviewModal = forwardRef<HTMLDivElement, FilePreviewModalProps>(
  ({ isOpen, onClose, resource, previewUrl, isLoading, error }, ref) => {
    if (!isOpen || !resource) return null; // Ensure a resource is provided to open

    const renderContent = () => {
      // Display loading state
      if (isLoading) {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p>Loading preview...</p>
          </div>
        );
      }

      // Display error state
      if (error) {
        return (
          <div className="bg-red-100 p-8 rounded-lg border-2 border-dashed border-red-300 flex flex-col items-center justify-center text-red-700">
            <AlertCircle className="w-16 h-16 mb-4" />
            <p className="mb-2">Error loading preview:</p>
            <p className="text-center font-medium">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 btn-secondary flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        );
      }

      // If no preview URL, or a type that cannot be directly embedded/previewed
      const cannotPreview = !previewUrl || ['document', 'other'].includes(resource.type);

      if (cannotPreview) {
        return (
          <div className="bg-gray-50 p-8 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">Preview not available for this file type or format.</p>
            {/* Direct download link within the preview area */}
            <a
              href={previewUrl || '#'} // Use previewUrl for download if available
              download={resource.originalName || resource.name}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download File
            </a>
          </div>
        );
      }

      // Render content based on resource type (now using previewUrl)
      switch (resource.type) {
        case 'image':
          return (
            <img
              src={previewUrl}
              alt={resource.name}
              className="max-w-full max-h-[80vh] object-contain"
            />
          );
        case 'video':
          return (
            <video
              controls
              className="max-w-full max-h-[80vh]"
              src={previewUrl}
            />
          );
        default:
          // This case should ideally not be reached if cannotPreview handles it
          return null;
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          ref={ref}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-medium">{resource.name}</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close preview"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-auto flex-1 flex items-center justify-center">
            {renderContent()}
          </div>

          {/* Moved the download button to be conditional based on previewUrl presence */}
          {previewUrl && (
            <div className="p-4 border-t flex justify-end">
              <a
                href={previewUrl}
                download={resource.originalName || resource.name}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }
);

FilePreviewModal.displayName = 'FilePreviewModal';

export default FilePreviewModal;