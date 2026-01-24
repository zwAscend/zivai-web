import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DevelopmentPlan, Student, StudentAttributes } from '../../types';
import { studentService, developmentService } from '../../services/api';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

// Simple Badge component
const Badge = ({ 
  children, 
  variant = 'default',
  className = '' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}) => {
  const baseStyles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  const variantStyles = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'text-foreground',
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
import { planningService } from '../../services/planningService';
import { useAuth } from '@/context/AuthContext';

interface DevelopmentPlanCreationProps {
  studentId?: string;
  courseId?: string;
}

const DevelopmentPlanCreation: React.FC<DevelopmentPlanCreationProps> = ({ 
  studentId: propStudentId,
  courseId: propCourseId 
}) => {
  const { studentId: paramStudentId, courseId: paramCourseId } = useParams<{ 
    studentId: string; 
    courseId: string 
  }>();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedCourse } = useAuth();
  
  const initialStudentId = propStudentId || paramStudentId || '';
  const initialCourseId = propCourseId || paramCourseId || selectedCourse?.id || '';
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentAttributes, setStudentAttributes] = useState<StudentAttributes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedSkill, setExpandedSkill] = useState<{
    skillIndex: number | null;
    subskillIndex: number | null;
  }>({ skillIndex: null, subskillIndex: null });
  
  // State for the plan being created
  const [planName, setPlanName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedSubskills, setSelectedSubskills] = useState<Set<string>>(new Set());

  // Fetch all students for the sidebar
  useEffect(() => {
    const fetchAllStudents = async () => {
      try {
        const studentsData = await studentService.getStudents();
        setAllStudents(studentsData);
      } catch (err: any) {
        console.error('Failed to fetch all students:', err);
        setError('Failed to load student list.');
      }
    };
    fetchAllStudents();
  }, []);

  // Fetch student data and attributes when student is selected
  useEffect(() => {
    const fetchData = async () => {
      if (!initialStudentId || !initialCourseId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch student data
        const studentData = await studentService.getStudent(initialStudentId);
        setSelectedStudent(studentData);
        
        // Fetch student attributes for the course
        try {
          const attributes = await developmentService.getStudentAttributes(initialStudentId, initialCourseId);
          setStudentAttributes(attributes);
        } catch (attrError) {
          console.error('Error fetching student attributes:', attrError);
          toast({
            title: 'Warning',
            description: 'Could not load student attributes. Some features may be limited.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        console.error('Error fetching student data:', err);
        setError('Failed to load student data.');
        toast({
          title: 'Error',
          description: 'Failed to load student data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [initialStudentId, initialCourseId, toast]);

  // Toggle skill expansion
  const toggleSkill = (index: number) => {
    setExpandedSkill(prev => ({
      skillIndex: prev.skillIndex === index ? null : index,
      subskillIndex: null
    }));
  };

  // Toggle subskill expansion
  const toggleSubskill = (skillIndex: number, subskillIndex: number) => {
    setExpandedSkill(prev => ({
      skillIndex,
      subskillIndex: prev.subskillIndex === subskillIndex ? null : subskillIndex
    }));
  };

  // Toggle skill selection
  const toggleSkillSelection = (skillId: string) => {
    const newSelectedSkills = new Set(selectedSkills);
    if (newSelectedSkills.has(skillId)) {
      newSelectedSkills.delete(skillId);
      // Also remove any selected subskills for this skill
      const skill = studentAttributes?.skills?.find(s => s.id === skillId);
      if (skill) {
        skill.subskills?.forEach(sub => {
          selectedSubskills.delete(sub.id);
        });
        setSelectedSubskills(new Set(selectedSubskills));
      }
    } else {
      newSelectedSkills.add(skillId);
    }
    setSelectedSkills(newSelectedSkills);
  };

  // Toggle subskill selection
  const toggleSubskillSelection = (skillId: string, subskillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedSubskills = new Set(selectedSubskills);
    
    if (newSelectedSubskills.has(subskillId)) {
      newSelectedSubskills.delete(subskillId);
    } else {
      newSelectedSubskills.add(subskillId);
    }
    
    setSelectedSubskills(newSelectedSubskills);
    
    // If any subskill is selected, ensure the parent skill is also selected
    if (newSelectedSubskills.has(subskillId) && !selectedSkills.has(skillId)) {
      setSelectedSkills(prev => new Set([...prev, skillId]));
    }
  };

  // Create the development plan
  const handleCreatePlan = async () => {
    if (!selectedStudent || !initialCourseId) return;
    
    setIsCreating(true);
    
    try {
      // Prepare plan data
      const planData = {
        name: planName || `Development Plan for ${selectedStudent.firstName} ${selectedStudent.lastName}`,
        studentId: selectedStudent._id,
        courseId: initialCourseId,
        skills: studentAttributes?.skills
          .filter(skill => selectedSkills.has(skill.id) || 
            skill.subskills?.some(sub => selectedSubskills.has(sub.id)))
          .map(skill => ({
            ...skill,
            subskills: skill.subskills?.filter(sub => selectedSubskills.has(sub.id))
          })),
        status: 'draft' as const,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      };
      
      // Generate the plan using the planning service
      const generatedPlan = await planningService.generateDevelopmentPlan(planData);
      
      // Save the plan
      const createdPlan = await developmentService.createCoursePlan(generatedPlan);
      
      // Show success message
      toast({
        title: 'Success',
        description: 'Development plan created successfully!',
      });
      
      // Navigate to the development view for this student
      navigate(`/classroom/development/${selectedStudent._id}`);
      
    } catch (error: any) {
      console.error('Error creating development plan:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create development plan',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Create Development Plan</h1>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePlan}
                disabled={isCreating || (selectedSkills.size === 0 && selectedSubskills.size === 0) || !planName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Plan'}
              </Button>
            </div>
          </div>
          
          {/* Plan Name Input */}
          <div className="mb-6">
            <label htmlFor="planName" className="block text-sm font-medium text-gray-700 mb-2">
              Plan Name
            </label>
            <input
              type="text"
              id="planName"
              className="w-full p-2 border rounded-md"
              placeholder="Enter a name for this development plan"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>
          
          {/* Student Info */}
          {selectedStudent && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Student</h2>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {selectedStudent.avatar ? (
                    <img 
                      src={selectedStudent.avatar} 
                      alt={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
                      className="aspect-square h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100">
                      <span className="text-sm font-medium text-blue-800">
                        {`${selectedStudent.firstName[0]}${selectedStudent.lastName[0]}`.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{`${selectedStudent.firstName} ${selectedStudent.lastName}`}</p>
                  <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Skills and Subskills */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Select Skills & Subskills</h2>
            
            {studentAttributes?.skills?.length ? (
              <div className="space-y-3">
                {studentAttributes.skills.map((skill, skillIndex) => {
                  const isSkillSelected = selectedSkills.has(skill.id);
                  const hasSelectedSubskills = skill.subskills?.some(sub => selectedSubskills.has(sub.id));
                  const isExpanded = expandedSkill.skillIndex === skillIndex;
                  
                  return (
                    <div key={skill.id} className="overflow-hidden border rounded-md">
                      <div 
                        className={`p-3 cursor-pointer ${isSkillSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleSkill(skillIndex)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSkillSelection(skill.id);
                              }}
                              className={`w-5 h-5 rounded border flex items-center justify-center ${isSkillSelected || hasSelectedSubskills ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}
                            >
                              {(isSkillSelected || hasSelectedSubskills) && <Check className="w-3 h-3" />}
                            </button>
                            <h3 className="text-base font-medium">
                              {skill.name}
                            </h3>
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full border">
                              {skill.score}%
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-2">
                              {skill.subskills?.filter(sub => selectedSubskills.has(sub.id)).length || 0}/{skill.subskills?.length || 0} selected
                            </span>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                        <div className="mt-2">
                          <Progress value={skill.score} className="h-2" />
                        </div>
                      </div>
                      
                      {isExpanded && skill.subskills?.length > 0 && (
                        <div className="p-0">
                          <div className="border-t">
                            {skill.subskills.map((subskill, subIndex) => {
                              const isSubskillSelected = selectedSubskills.has(subskill.id);
                              const isSubExpanded = expandedSkill.subskillIndex === subIndex;
                              
                              return (
                                <div key={subskill.id} className="border-b last:border-b-0">
                                  <div 
                                    className="p-3 pl-10 pr-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                    onClick={(e) => toggleSubskill(skillIndex, subIndex)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={(e) => toggleSubskillSelection(skill.id, subskill.id, e)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center ${isSubskillSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}
                                      >
                                        {isSubskillSelected && <Check className="w-3 h-3" />}
                                      </button>
                                      <span className="text-sm">{subskill.name}</span>
                                      <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                                        {subskill.score}%
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      <Progress 
                                        value={subskill.score} 
                                        className="h-2 w-24 mr-3" 
                                        indicatorClassName={subskill.score > 70 ? 'bg-green-500' : subskill.score > 40 ? 'bg-yellow-500' : 'bg-red-500'}
                                      />
                                      {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </div>
                                  </div>
                                  
                                  {isSubExpanded && (
                                    <div className="bg-gray-50 p-3 pl-16 text-sm text-gray-600">
                                      <p className="mb-2">{subskill.description || 'No description available.'}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">Current Level:</span>
                                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                                          {getPerformanceLevel(subskill.score)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No skills data available for this student.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar with student list */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-4">
            <h2 className="text-lg font-semibold mb-4">Students</h2>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              {allStudents.map(student => (
                <div 
                  key={student._id}
                  className={`p-3 mb-2 border rounded-md cursor-pointer transition-colors ${
                    student._id === selectedStudent?._id 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => navigate(`/classroom/development/create/${student._id}/${initialCourseId}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                      {student.avatar ? (
                        <img 
                          src={student.avatar} 
                          alt={`${student.firstName} ${student.lastName}`}
                          className="aspect-square h-full w-full"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100">
                          <span className="text-sm font-medium text-blue-800">
                            {`${student.firstName[0]}${student.lastName[0]}`.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{`${student.firstName} ${student.lastName}`}</p>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors bg-secondary text-secondary-foreground">
                          {getPerformanceLevel(student.overallGrade || student.overall || 0)}
                        </span>
                        <span className="text-xs text-gray-500">
                          OVR: {(student.overallGrade || student.overall)?.toFixed(1) || 'N/A'}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {student.attendance && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Attendance</span>
                        <span>{typeof student.attendance === 'object' ? student.attendance.percentage : student.attendance}%</span>
                      </div>
                      <Progress 
                        value={typeof student.attendance === 'object' ? student.attendance.percentage : student.attendance} 
                        className="h-1.5" 
                      />
                    </div>
                  )}
                  
                  {student.currentPlan && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Current Plan</span>
                        <span className="font-medium">{student.currentPlan.progress}%</span>
                      </div>
                      <Progress value={student.currentPlan.progress} className="h-1.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get performance level based on score
function getPerformanceLevel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 30) return 'Needs Improvement';
  return 'At Risk';
}

export default DevelopmentPlanCreation;
