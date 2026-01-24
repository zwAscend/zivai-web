import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  User, 
  Target, 
  TrendingUp, 
  BookOpen, 
  CheckCircle,
  AlertCircle,
  X,
  Sparkles
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { studentService, developmentService } from '../../services/api';
import { planningService } from '../../services/planningService';
import { Student } from '../../types';
import { useAuth } from '@/context/AuthContext';

interface CreateDevelopmentPlanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanCreated: (studentId: string, plan: any) => void;
  students: Student[];
  courseId: string;
}

const CreateDevelopmentPlanModal: React.FC<CreateDevelopmentPlanModalProps> = ({
  isOpen,
  onOpenChange,
  onPlanCreated,
  students: initialStudents = [],
  courseId
}) => {
  const [students, setStudents] = React.useState<Student[]>(initialStudents || []);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string>('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [isFetchingStudents, setIsFetchingStudents] = React.useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = React.useState(false);
  const [createdPlan, setCreatedPlan] = React.useState<any>(null);
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  
  const { selectedCourse } = useAuth();
  const { toast } = useToast();

  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    if (variant === 'destructive') {
      toast.error(description);
    } else {
      toast.success(description);
    }
  };

  // Fetch students when modal opens
  React.useEffect(() => {
    const fetchStudents = async () => {
      if (!isOpen || students.length > 0) return;

      try {
        setIsFetchingStudents(true);
        const data = await studentService.getStudents();
        setStudents(data);
      } catch (err) {
        console.error('Error fetching students:', err);
        showToast('Error', 'Failed to load students. Please try again.', 'destructive');
      } finally {
        setIsFetchingStudents(false);
      }
    };

    fetchStudents();
  }, [isOpen]);

  // Update selected student when ID changes
  React.useEffect(() => {
    if (selectedStudentId) {
      const student = students.find(s => s._id === selectedStudentId);
      setSelectedStudent(student || null);
    } else {
      setSelectedStudent(null);
    }
  }, [selectedStudentId, students]);

  const handleCreatePlan = React.useCallback(async () => {
    if (!selectedStudentId) {
      showToast('Error', 'Please select a student', 'destructive');
      return;
    }

    try {
      setIsGenerating(true);
      const student = students.find(s => s._id === selectedStudentId);
      if (!student) throw new Error('Selected student not found');
      if (!selectedCourse?.id) throw new Error('No course selected. Please select a course first.');

      const courseId = selectedCourse.id;
      
      const studentAttributesResponse = await developmentService.getStudentAttributes(selectedStudentId, courseId);
      
      const courseAttributes: any[] = [];
      const studentAttributeValues: Record<string, any> = {};
      
      if (Array.isArray(studentAttributesResponse)) {
        studentAttributesResponse.forEach((item: any) => {
          if (item.attribute && (typeof item.current === 'number' || typeof item.potential === 'number')) {
            const attributeId = item.attribute._id || item.attribute.id;
            if (attributeId) {
              if (!courseAttributes.some(attr => attr._id === attributeId || attr.id === attributeId)) {
                courseAttributes.push({
                  _id: attributeId,
                  id: attributeId,
                  name: item.attribute.name || `Attribute ${attributeId}`,
                  description: item.attribute.description || '',
                });
              }

              studentAttributeValues[attributeId] = {
                current: item.current || 0,
                potential: item.potential || 0
              };
            }
          }
        });
      }

      const targetScores = Object.entries(studentAttributeValues).reduce<Record<string, number>>(
        (acc, [attributeId, value]) => {
          if (value) {
            const current = value.current || 0;
            return {
              ...acc,
              [attributeId]: Math.min(Math.round(Number(current) * 1.2), 100)
            };
          }
          return acc;
        },
        {}
      );

      const formattedCourseAttributes = courseAttributes.map(attr => ({
        _id: attr._id || attr.id || 'unknown',
        name: attr.name || 'Unnamed Attribute',
        description: attr.description || ''
      }));

      const formattedStudentAttributes = { ...studentAttributeValues };

      if (formattedCourseAttributes.length === 0) {
        formattedCourseAttributes.push({
          _id: 'default-attribute',
          name: 'Overall Performance',
          description: 'General performance across all course metrics'
        });
        
        if (Object.keys(formattedStudentAttributes).length === 0) {
          formattedStudentAttributes['default-attribute'] = {
            current: student.overall || 0,
            potential: Math.min(100, Math.round((student.overall || 0) * 1.2))
          };
        }
      }

      const planData = {
        student: {
          _id: student._id,
          id: student.id || student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email || '',
          overall: student.overall || 0,
          strength: student.strength || '',
          performance: student.performance || '',
          engagement: student.engagement || 0,
          courses: student.courses || []
        },
        courseId,
        courseName: selectedCourse?.name || 'Course Name',
        attributes: formattedCourseAttributes,
        studentAttributes: formattedStudentAttributes,
        targetScores
      };

      const plan = await planningService.generateDevelopmentPlan(planData as any);

      const planToSave = {
        ...plan,
        studentId: selectedStudentId,
        courseId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await developmentService.createCoursePlan(planToSave as any);

      setCreatedPlan(created);
      setIsReviewModalOpen(true);
    } catch (error) {
      console.error('Error creating development plan:', error);
      showToast('Error', error instanceof Error ? error.message : 'Failed to create development plan', 'destructive');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedStudentId, students, onPlanCreated, selectedCourse]);

  const handleAssignPlan = async () => {
    if (!createdPlan || isAssigning) return;
    
    try {
      setIsAssigning(true);
      if (!selectedCourse?.id) throw new Error('No course selected');
      
      const assignedPlan = await developmentService.assignPlanToStudent(
        selectedStudentId, 
        createdPlan._id,
        selectedCourse?.id || courseId
      );
      
      onPlanCreated(selectedStudentId, assignedPlan);
      showToast('Success', 'Development plan assigned successfully');
      
      setIsReviewModalOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning plan:', error);
      showToast('Error', error instanceof Error ? error.message : 'Failed to assign development plan', 'destructive');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      {/* Main Creation Modal */}
      <Dialog open={isOpen && !isReviewModalOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">
                    Create Development Plan
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 mt-1">
                    Generate a personalized learning plan using AI
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Course Info */}
            {selectedCourse && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="font-semibold text-indigo-900">{selectedCourse.name}</h3>
                    <p className="text-sm text-indigo-700">{selectedCourse.code}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Student Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Select Student</h3>
                <span className="text-red-500">*</span>
              </div>

              <Select
                value={selectedStudentId}
                onValueChange={setSelectedStudentId}
                disabled={isFetchingStudents || isGenerating}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder={
                    isFetchingStudents ? 'Loading students...' : 'Choose a student...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student._id} value={student._id}>
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {student.firstName[0]}{student.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-gray-500">{student.id}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  {students.length === 0 && !isFetchingStudents && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No students available
                    </div>
                  )}
                </SelectContent>
              </Select>

              {/* Selected Student Preview */}
              {selectedStudent && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-purple-600">
                        {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </h4>
                      <p className="text-sm text-gray-600">{selectedStudent.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{selectedStudent.overall}</div>
                      <p className="text-xs text-gray-500">Current OVR</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Strength:</p>
                      <Badge variant="outline" className="mt-1">{selectedStudent.strength}</Badge>
                    </div>
                    <div>
                      <p className="text-gray-600">Performance:</p>
                      <Badge variant="outline" className="mt-1">{selectedStudent.performance}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedStudent ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Ready to generate plan for {selectedStudent.firstName}
                  </div>
                ) : (
                  'Select a student to continue'
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePlan}
                  disabled={!selectedStudentId || isGenerating}
                  className="min-w-[140px] bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Plan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">
                    Review Development Plan
                  </DialogTitle>
                  <DialogDescription className="text-green-100 mt-1">
                    Review the AI-generated plan before assigning to student
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          {createdPlan && selectedStudent && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Plan Overview */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-green-900">{createdPlan.name}</h3>
                      <p className="text-green-700 mt-1">
                        For {selectedStudent.firstName} {selectedStudent.lastName}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">
                        {createdPlan.potentialOverall}%
                      </div>
                      <p className="text-sm text-green-700">Target Score</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                      <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-green-700">Current</p>
                      <p className="text-lg font-bold text-green-900">{selectedStudent.overall}%</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                      <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-green-700">Potential</p>
                      <p className="text-lg font-bold text-green-900">{createdPlan.potentialOverall}%</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                      <BookOpen className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-green-700">Timeline</p>
                      <p className="text-lg font-bold text-green-900">{createdPlan.eta} days</p>
                    </div>
                  </div>
                </div>

                {/* Learning Steps */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Learning Path ({createdPlan.steps?.length || 0} steps)
                  </h4>
                  
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {createdPlan.steps?.map((step: any, index: number) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-1">{step.title}</h5>
                            <Badge variant="outline" className="text-xs mb-2">
                              {step.type}
                            </Badge>
                            
                            {step.link && (
                              <div className="mt-2">
                                <a 
                                  href={step.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  Primary Resource
                                </a>
                                
                                {step.additionalResources?.map((resource: string, resIndex: number) => (
                                  <a 
                                    key={resIndex}
                                    href={resource} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 ml-4 mt-1"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    Additional Resource {resIndex + 1}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Future: Handle edit logic
                    showToast('Info', 'Edit functionality coming soon');
                  }}
                >
                  Edit Plan
                </Button>
                <Button 
                  onClick={handleAssignPlan}
                  disabled={isAssigning}
                  className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Assign Plan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateDevelopmentPlanModal;