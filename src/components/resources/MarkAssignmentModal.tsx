import React, { useState, DragEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { 
  Loader2, 
  X, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Award,
  Eye,
  Download
} from 'lucide-react';
import { markingService } from '@/services/markingService';
import { toast } from 'sonner';

interface MarkAssignmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MarkingResult {
  marks: number;
  feedback: string;
  criteria: Array<{
    criterion: string;
    score: number;
    comments: string;
  }>;
}

export const MarkAssignmentModal: React.FC<MarkAssignmentModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MarkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setResults(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setError(null);
        setResults(null);
      } else {
        setError('Please upload a PDF, Word document, or text file');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file to mark');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await markingService.markDocument(file);
      setResults(result);
      toast.success('Assignment marked successfully');
    } catch (error) {
      console.error('Error marking assignment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark assignment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setError(null);
    setIsLoading(false);
    onOpenChange(false);
  };

  const getGradeColor = (marks: number) => {
    if (marks >= 85) return 'text-green-600 bg-green-100';
    if (marks >= 70) return 'text-blue-600 bg-blue-100';
    if (marks >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCriterionColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  AI Assignment Marker
                </DialogTitle>
                <p className="text-blue-100 mt-1">
                  Upload an assignment to get instant AI-powered grading and feedback
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            /* Upload Section */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload Area */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Upload Assignment</h3>
                </div>
                
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : error 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <FileText className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                        dragActive ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Upload className={`w-8 h-8 ${
                          dragActive ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-gray-900">
                          {dragActive ? 'Drop your file here' : 'Upload assignment file'}
                        </p>
                        <p className="text-gray-500 mt-1">
                          Drag & drop or click to browse
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          Supported: PDF, DOC, DOCX, TXT (max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading || !file}
                  className="min-w-[140px] bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 mr-2" />
                      Mark Assignment
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            /* Results Section */
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-green-900">Marking Results</h3>
                  <Badge className={`text-lg px-4 py-2 ${getGradeColor(results.marks)}`}>
                    {results.marks}/100
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700 font-medium">Overall Performance</span>
                    <span className="text-green-900 font-bold">{results.marks}%</span>
                  </div>
                  <Progress value={results.marks} className="h-3" />
                </div>
              </div>

              {/* Criteria Breakdown */}
              {results.criteria.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Detailed Breakdown
                  </h4>
                  
                  <div className="grid gap-4">
                    {results.criteria.map((criterion, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold text-gray-800">{criterion.criterion}</h5>
                          <Badge variant="outline" className="font-bold">
                            {criterion.score}/100
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <Progress 
                            value={criterion.score} 
                            className="h-2"
                            style={{
                              '--progress-background': getCriterionColor(criterion.score)
                            } as React.CSSProperties}
                          />
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {criterion.comments}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Feedback */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Overall Feedback
                </h4>
                <div className="prose prose-sm max-w-none">
                  <p className="text-blue-800 leading-relaxed whitespace-pre-wrap">
                    {results.feedback}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults(null);
                    setFile(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Mark Another
                </Button>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Export results functionality
                      const exportData = {
                        fileName: file?.name,
                        marks: results.marks,
                        feedback: results.feedback,
                        criteria: results.criteria,
                        markedAt: new Date().toISOString()
                      };
                      
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                        type: 'application/json'
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `marking-results-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Results
                  </Button>
                  
                  <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};