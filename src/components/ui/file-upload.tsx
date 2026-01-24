import React, { useState } from 'react';
import { Button } from './button';
import { FileUpload as FileUploadIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function FileUpload({ onFileSelect, accept }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
      <div
        className="flex flex-col items-center justify-center p-4"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <FileUploadIcon className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500">
            {isDragging ? 'Drop file here' : 'Drag & drop your file here'}
          </p>
          <p className="text-xs text-gray-400">
            or
            <Button
              variant="outline"
              className="ml-2"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept || '';
                input.onchange = handleFileSelect;
                input.click();
              }}
            >
              browse
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
