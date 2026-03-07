import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Student, StudentAttributes, SubjectAttribute } from '../../types';
import { studentService, developmentService } from '../../services/api';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { planningService } from '../../services/planningService';
import { useAuth } from '@/context/AuthContext';

interface DevelopmentPlanCreationProps {
  studentId?: string;
  subjectId?: string;
}

interface SkillSubItem {
  id: string;
  name: string;
  score: number;
  description?: string;
}

interface SkillItem {
  id: string;
  name: string;
  score: number;
  subskills: SkillSubItem[];
}

const formatAttributeName = (attributeId: string): string =>
  attributeId
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const mapStudentAttributesToSkills = (attributes: StudentAttributes | null): SkillItem[] => {
  if (!attributes) return [];

  return Object.entries(attributes).map(([attributeId, values]) => {
    const current = Number(values?.current ?? 0);
    const potential = Number(values?.potential ?? current);

    return {
      id: attributeId,
      name: formatAttributeName(attributeId),
      score: current,
      subskills: [
        {
          id: `${attributeId}-target`,
          name: `${formatAttributeName(attributeId)} target`,
          score: potential,
          description: `Current ${current}%, potential ${potential}%.`,
        },
      ],
    };
  });
};

const getAttendancePercentage = (student: Student): number | null => {
  const rawAttendance = (student as { attendance?: unknown }).attendance;
  if (typeof rawAttendance === 'number') return rawAttendance;
  if (rawAttendance && typeof rawAttendance === 'object') {
    const attendanceObject = rawAttendance as { percentage?: unknown };
    if (typeof attendanceObject.percentage === 'number') {
      return attendanceObject.percentage;
    }
  }
  return null;
};

const DevelopmentPlanCreation: React.FC<DevelopmentPlanCreationProps> = ({ 
  studentId: propStudentId,
  subjectId: propSubjectId 
}) => {
  const { studentId: paramStudentId, subjectId: paramSubjectId } = useParams<{ 
    studentId: string; 
    subjectId: string 
  }>();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedSubject } = useAuth();
  
  const initialStudentId = propStudentId || paramStudentId || '';
  const initialSubjectId = propSubjectId || paramSubjectId || selectedSubject?.id || '';
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentAttributes, setStudentAttributes] = useState<StudentAttributes | null>(null);
  const [subjectAttributes, setSubjectAttributes] = useState<SubjectAttribute[]>([]);
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
  const skills = mapStudentAttributesToSkills(studentAttributes);

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
      if (!initialStudentId || !initialSubjectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch student data
        const studentData = await studentService.getStudent(initialStudentId);
        setSelectedStudent(studentData);
        
        // Fetch student attributes for the subject
        try {
          const [attributes, attributeDefs] = await Promise.all([
            developmentService.getStudentAttributes(initialStudentId, initialSubjectId),
            developmentService.getSubjectAttributes(initialSubjectId).catch(() => []),
          ]);
          setStudentAttributes(attributes);
          setSubjectAttributes(attributeDefs);
        } catch (attrError) {
          console.error('Error fetching student attributes:', attrError);
          toast.error('Could not load student attributes. Some features may be limited.');
        }
      } catch (err: any) {
        console.error('Error fetching student data:', err);
        setError('Failed to load student data.');
        toast.error('Failed to load student data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [initialStudentId, initialSubjectId, toast]);

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
      const skill = skills.find((s) => s.id === skillId);
      if (skill) {
        skill.subskills.forEach((sub) => {
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
  const handleCreatePlan = async (mode: 'ai' | 'manual') => {
    if (!selectedStudent || !initialSubjectId) return;
    
    setIsCreating(true);
    
    try {
      const selectedSkillItems = skills.filter((skill) =>
        selectedSkills.has(skill.id) || skill.subskills.some((sub) => selectedSubskills.has(sub.id))
      );
      const selectedAttributeIds = new Set(selectedSkillItems.map((skill) => skill.id));
      const selectedAttributes = subjectAttributes.filter((attribute) => selectedAttributeIds.has(attribute.id));
      const targetScores = selectedSkillItems.reduce<Record<string, number>>((accumulator, skill) => {
        accumulator[skill.id] = Math.min(100, Math.max(skill.score + 10, 70));
        return accumulator;
      }, {});

      const generationParams = {
        student: selectedStudent,
        subjectId: initialSubjectId,
        attributes: selectedAttributes,
        studentAttributes: studentAttributes || {},
        targetScores,
        subjectName: selectedSubject?.name || 'Selected subject',
      };

      const generatedPlan = mode === 'ai'
        ? await planningService.generateDevelopmentPlan(generationParams)
        : planningService.generateLocalPlan(generationParams);

      const normalizedPlan = {
        ...generatedPlan,
        name: planName.trim(),
      };
      
      // Save the plan
      await developmentService.createSubjectPlan(normalizedPlan as any);
      
      // Show success message
      toast.success('Development plan created successfully!');
      
      // Navigate to the development view for this student
      navigate(`/development/${selectedStudent.id}`);
      
    } catch (error: any) {
      console.error('Error creating development plan:', error);
      toast.error(error.message || 'Failed to create development plan');
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
                variant="outline"
                onClick={() => handleCreatePlan('manual')}
                disabled={isCreating || (selectedSkills.size === 0 && selectedSubskills.size === 0) || !planName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Manually'}
              </Button>
              <Button 
                onClick={() => handleCreatePlan('ai')}
                disabled={isCreating || (selectedSkills.size === 0 && selectedSubskills.size === 0) || !planName.trim()}
              >
                {isCreating ? 'Creating...' : 'Generate with AI'}
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
            
            {skills.length ? (
              <div className="space-y-3">
                {skills.map((skill, skillIndex) => {
                  const isSkillSelected = selectedSkills.has(skill.id);
                  const hasSelectedSubskills = skill.subskills.some((sub) => selectedSubskills.has(sub.id));
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
                              {skill.subskills.filter((sub) => selectedSubskills.has(sub.id)).length || 0}/{skill.subskills.length || 0} selected
                            </span>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                        <div className="mt-2">
                          <Progress value={skill.score} className="h-2" />
                        </div>
                      </div>
                      
                      {isExpanded && skill.subskills.length > 0 && (
                        <div className="p-0">
                          <div className="border-t">
                            {skill.subskills.map((subskill, subIndex) => {
                              const isSubskillSelected = selectedSubskills.has(subskill.id);
                              const isSubExpanded = expandedSkill.subskillIndex === subIndex;
                              
                              return (
                                <div key={subskill.id} className="border-b last:border-b-0">
                                  <div 
                                    className="p-3 pl-10 pr-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                    onClick={() => toggleSubskill(skillIndex, subIndex)}
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
                  key={student.id}
                  className={`p-3 mb-2 border rounded-md cursor-pointer transition-colors ${
                    student.id === selectedStudent?.id 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => navigate(`/development/create/${student.id}/${initialSubjectId}`)}
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
                          {getPerformanceLevel(student.overall || 0)}
                        </span>
                        <span className="text-xs text-gray-500">
                          OVR: {typeof student.overall === 'number' ? student.overall.toFixed(1) : 'N/A'}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {getAttendancePercentage(student) != null && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Attendance</span>
                        <span>{getAttendancePercentage(student)}%</span>
                      </div>
                      <Progress 
                        value={getAttendancePercentage(student) || 0}
                        className="h-1.5" 
                      />
                    </div>
                  )}
                  
                  {student.activePlan && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Current Plan</span>
                        <span className="font-medium">{student.activePlan.currentProgress}%</span>
                      </div>
                      <Progress value={student.activePlan.currentProgress} className="h-1.5" />
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
