import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Plus, 
  Upload, 
  FileText, 
  Settings, 
  Target, 
  Calendar,
  Hash,
  BookOpen,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { SubjectAttribute, QuestionType, AssessmentType } from '@/types';

interface DetailsStepProps {
  formData: {
    name: string;
    description: string;
    type: AssessmentType;
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard';
    questionTypes: QuestionType[];
    selectedAttributes: string[];
    maxScore: number;
    weight: number;
    dueDate: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    description: string;
    type: AssessmentType;
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard';
    questionTypes: QuestionType[];
    selectedAttributes: string[];
    maxScore: number;
    weight: number;
    dueDate: string;
  }>>;
  attributes: SubjectAttribute[];
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  isLoading: boolean;
}

export function DetailsStep({ 
  formData, 
  setFormData, 
  attributes, 
  uploadedFile, 
  setUploadedFile,
  isLoading 
}: DetailsStepProps) {
  const [dragActive, setDragActive] = useState(false);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  }, [setUploadedFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  // Toggle question type selection
  const toggleQuestionType = (type: QuestionType) => {
    setFormData(prev => {
      const newTypes = prev.questionTypes.includes(type)
        ? prev.questionTypes.filter(t => t !== type)
        : [...prev.questionTypes, type];
      
      if (newTypes.length === 0) {
        return prev;
      }
      
      return { ...prev, questionTypes: newTypes };
    });
  };

  // Toggle attribute selection
  const toggleAttribute = (attributeId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAttributes: prev.selectedAttributes.includes(attributeId)
        ? prev.selectedAttributes.filter(id => id !== attributeId)
        : [...prev.selectedAttributes, attributeId],
    }));
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'questionCount' || name === 'maxScore' || name === 'weight'
        ? parseInt(value, 10) || 0
        : value,
    }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const questionTypeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Multiple Choice',
    true_false: 'True/False',
    short_answer: 'Short Answer',
    essay: 'Essay',
    code: 'Code',
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Assessment Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Network Security Quiz - Chapter 5"
              className="h-11"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of what this assessment covers..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </div>

      {/* Assessment Configuration */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Target className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Assessment Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium text-gray-700">Assessment Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => handleSelectChange('type', value as AssessmentType)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {['Quiz', 'Test', 'Assignment', 'Exam', 'Exercise'].map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="difficulty" className="text-sm font-medium text-gray-700">Difficulty Level</Label>
            <Select 
              value={formData.difficulty} 
              onValueChange={(value) => handleSelectChange('difficulty', value)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Easy
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    Medium
                  </div>
                </SelectItem>
                <SelectItem value="hard">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Hard
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="questionCount" className="text-sm font-medium text-gray-700">Number of Questions</Label>
            <Input
              id="questionCount"
              name="questionCount"
              type="number"
              min="1"
              max="50"
              value={formData.questionCount}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxScore" className="text-sm font-medium text-gray-700">Maximum Score</Label>
            <Input
              id="maxScore"
              name="maxScore"
              type="number"
              min="1"
              value={formData.maxScore}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium text-gray-700">Weight (%)</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              min="1"
              max="100"
              value={formData.weight}
              onChange={handleInputChange}
              className="h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate" className="text-sm font-medium text-gray-700">Due Date</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={handleInputChange}
              min={new Date().toISOString().split('T')[0]}
              className="h-11"
            />
          </div>
        </div>
      </div>

      {/* Question Types */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Hash className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Question Types</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(questionTypeLabels).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleQuestionType(type as QuestionType)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                formData.questionTypes.includes(type as QuestionType)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {formData.questionTypes.includes(type as QuestionType) ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{label}</span>
              </div>
            </button>
          ))}
        </div>
        
        {formData.questionTypes.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-700">Please select at least one question type</p>
          </div>
        )}
      </div>
      
      {/* Subject Attributes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Target className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Learning Objectives</h3>
          <span className="text-red-500">*</span>
        </div>
        
        <p className="text-sm text-gray-600">
          Select the subject attributes this assessment will evaluate
        </p>
        
        {attributes.length > 0 ? (
          <div className="grid gap-3 max-h-60 overflow-y-auto p-1">
            {attributes.map((attribute) => (
              <button
                key={attribute.id}
                type="button"
                onClick={() => toggleAttribute(attribute.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.selectedAttributes.includes(attribute.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{attribute.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {attribute.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{attribute.description}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    formData.selectedAttributes.includes(attribute.id)
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-gray-300'
                  }`}>
                    {formData.selectedAttributes.includes(attribute.id) && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No attributes found for this subject. Please add attributes in the subject settings.
            </p>
          </div>
        )}
        
        {formData.selectedAttributes.length === 0 && attributes.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-700">Please select at least one learning objective</p>
          </div>
        )}
      </div>
      
      {/* Reference Document */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Upload className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">Reference Document</h3>
          <span className="text-gray-500 text-sm">(Optional)</span>
        </div>
        
        <p className="text-sm text-gray-600">
          Upload a document to help generate more relevant and specific questions
        </p>
        
        {!uploadedFile ? (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragActive 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                isDragActive ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <Upload className={`w-8 h-8 ${
                  isDragActive ? 'text-orange-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive ? 'Drop your file here' : 'Upload reference document'}
                </p>
                <p className="text-gray-500 mt-1">
                  Drag & drop or click to browse
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  PDF, DOCX, or TXT up to 10MB
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-orange-900">{uploadedFile.name}</p>
                  <p className="text-sm text-orange-700">
                    {formatFileSize(uploadedFile.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadedFile(null)}
                className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-full transition-colors"
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Configuration Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Questions:</span>
              <span className="font-medium">{formData.questionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Question Types:</span>
              <span className="font-medium">{formData.questionTypes.length} selected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Difficulty:</span>
              <Badge variant="outline" className="text-xs">
                {formData.difficulty}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Learning Objectives:</span>
              <span className="font-medium">{formData.selectedAttributes.length} selected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reference Document:</span>
              <span className="font-medium">{uploadedFile ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Score:</span>
              <span className="font-medium">{formData.maxScore} points</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}