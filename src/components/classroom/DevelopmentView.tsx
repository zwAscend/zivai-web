import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DevelopmentPlan, Student, Plan, Skill, Subskill, SkillColor } from '../../types';
import { studentService, developmentService } from '../../services/api';
import { useToast } from "@/components/ui/use-toast";
import CreateDevelopmentPlanModal from '../resources/CreateDevelopmentPlanModal';

interface DevelopmentViewProps {
  studentId?: string;
}

const DevelopmentView: React.FC<DevelopmentViewProps> = ({ studentId: propStudentId }) => {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const initialStudentId = propStudentId || paramStudentId || '';

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allStudentDevelopmentPlans, setAllStudentDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [currentDisplayPlan, setCurrentDisplayPlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [expandedSkill, setExpandedSkill] = useState<{
    skillIndex: number | null;
    subskillIndex: number | null;
  }>({ skillIndex: null, subskillIndex: null });
  const { toast } = useToast();

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const studentData = await studentService.getStudent(initialStudentId);
        setSelectedStudent(studentData);

        const plansData = await developmentService.getAllPlansForStudent(initialStudentId);
        setAllStudentDevelopmentPlans(plansData);

        const activePlan = plansData.find(plan => plan.status === 'Active');
        setCurrentDisplayPlan(activePlan || plansData[0] || null);
      } catch (err: any) {
        console.error('Error fetching student or development plans:', err);
        setError(err.message || 'Failed to load student development data.');
      } finally {
        setLoading(false);
      }
    };

    if (initialStudentId) {
      fetchData();
    }
  }, [initialStudentId]);

  const handleStudentSelect = async (newStudentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const studentData = await studentService.getStudent(newStudentId);
      setSelectedStudent(studentData);

      const plansData = await developmentService.getAllPlansForStudent(newStudentId);
      setAllStudentDevelopmentPlans(plansData);

      const activePlan = plansData.find(plan => plan.status === 'Active');
      setCurrentDisplayPlan(activePlan || plansData[0] || null);
    } catch (err: any) {
      console.error('Error fetching student or development plans on select:', err);
      setError(err.message || 'Failed to load data for selected student.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (planToDisplay: DevelopmentPlan) => {
    setCurrentDisplayPlan(planToDisplay);
  };

  const handleCreatePlan = () => {
    if (!selectedStudent) {
      toast.error('No student selected');
      return;
    }
    setIsCreatePlanModalOpen(true);
  };

  const handlePlanCreated = async (studentId: string, newPlan: DevelopmentPlan['plan']) => {
    try {
      const updatedPlans = await developmentService.getAllPlansForStudent(studentId);
      setAllStudentDevelopmentPlans(updatedPlans);

      const newPlanItem = updatedPlans.find((p: DevelopmentPlan) => p.plan._id === newPlan._id);
      setCurrentDisplayPlan(newPlanItem || updatedPlans[0]);
      toast.success('Development plan created successfully');
    } catch (error) {
      console.error('Error handling new plan:', error);
      toast.error('Failed to load the new plan');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full text-sm">Loading development data...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-full text-red-600 text-sm">Error: {error}</div>;
  }

  if (!selectedStudent || !currentDisplayPlan) {
    return <div className="flex justify-center items-center h-full text-sm">No student or development plan found.</div>;
  }

  const fullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`;

  const getCurrentSkills = (): { mainSkills: Skill[] } => {
    if (currentDisplayPlan?.plan?.skills) {
      return {
        mainSkills: currentDisplayPlan.plan.skills.map(skill => {
          const progress = currentDisplayPlan.skillProgress?.find(p => p.skill === skill.name);
          return {
            ...skill,
            score: progress?.currentScore || skill.score,
            subskills: skill.subskills.map(sub => ({
              ...sub,
              color: (sub.score > 70 ? 'cyan' : 'yellow') as SkillColor,
            })),
          };
        }),
      };
    }
    return { mainSkills: [] };
  };

  const currentSkills = getCurrentSkills();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[60vh] p-0">
      {/* Modal */}
      {selectedStudent && (
        <CreateDevelopmentPlanModal
          isOpen={isCreatePlanModalOpen}
          onOpenChange={setIsCreatePlanModalOpen}
          onPlanCreated={handlePlanCreated}
          students={[selectedStudent]}
          courseId={selectedStudent.courses?.[0] || ''}
        />
      )}

      {/* Left Sidebar */}
      <div className="lg:col-span-2 col-span-12 bg-gray-50 rounded-lg shadow p-2 flex flex-col overflow-hidden">
        <div className="bg-white rounded-lg p-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-700 text-white text-sm font-bold rounded-full flex items-center justify-center mx-auto mb-1">
            {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
          </div>
          <div className="text-right mb-1">
            <div className="text-gray-600 text-[9px]">OVR</div>
            <div className="text-lg font-bold">{selectedStudent.overall}</div>
          </div>
          <div className="text-center">
            <h2 className="text-[10px] font-bold mb-0.5">{fullName}</h2>
            <p className="text-gray-600 text-[9px]">Plan | {currentDisplayPlan.plan.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-2 flex-1 overflow-y-auto">
          <h3 className="font-bold text-center mb-1.5 text-[10px]">Growth Area</h3>
          <div className="space-y-1">
            {allStudentDevelopmentPlans.map((planItem) => (
              <button
                key={planItem._id}
                onClick={() => handlePlanSelect(planItem)}
                className={`w-full p-1.5 rounded-lg text-[10px] font-medium transition-all duration-300 flex justify-between items-center
                  ${planItem._id === currentDisplayPlan._id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                `}
              >
                <span>{planItem.plan.name}</span>
                {planItem.status === 'Active' && (
                  <span className="text-[9px] bg-green-200 text-green-700 px-1 py-0.5 rounded-full">Active</span>
                )}
              </button>
            ))}
          </div>
          <button
            className="w-full mt-2 bg-blue-900 text-white py-1 px-2 rounded-lg hover:bg-blue-800 transition-colors text-[10px]"
            onClick={handleCreatePlan}
          >
            Custom Plan
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-7 col-span-12 bg-gray-50 rounded-lg shadow p-2 overflow-y-auto">
        <div className="mb-2">
          <h1 className="text-sm font-bold mb-1">{currentDisplayPlan.plan.name}</h1>
          <div className="flex flex-wrap gap-2 mb-1">
            <div>
              <span className="text-gray-600 text-[9px]">Progress</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-24 bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-green-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${currentDisplayPlan.currentProgress}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-medium">{currentDisplayPlan.currentProgress}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-blue-100 text-blue-900 p-1 rounded text-center">
                <div className="text-[8px]">ETA</div>
                <div className="text-[10px] font-semibold">{currentDisplayPlan.plan.eta} Days</div>
              </div>
              <div className="bg-green-100 text-green-900 p-1 rounded text-center">
                <div className="text-[8px]">Performance</div>
                <div className="text-[10px] font-semibold">{currentDisplayPlan.plan.performance}</div>
              </div>
            </div>
          </div>
          <p className="text-gray-600 text-[9px]">{currentDisplayPlan.plan.description}</p>
        </div>

        <div className={`grid gap-1.5 ${currentSkills.mainSkills.length <= 3 ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {currentSkills.mainSkills.map((skill, skillIndex) => (
            <div 
              key={skillIndex} 
              className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md ${
                expandedSkill.skillIndex === skillIndex ? 'ring-1 ring-blue-500' : ''
              }`}
              onClick={() => {
                setExpandedSkill(prev => ({
                  skillIndex: prev.skillIndex === skillIndex ? null : skillIndex,
                  subskillIndex: null
                }));
              }}
            >
              {/* Main Skill Card */}
              <div className="p-1 text-center cursor-pointer">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-gray-800">{skill.score}</div>
                    <div className="text-gray-600 text-[8px] font-medium">{skill.name}</div>
                  </div>
                  <div className={`text-[8px] transform transition-transform duration-300 ${
                    expandedSkill.skillIndex === skillIndex ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </div>
                </div>
              </div>
              
              {/* Subskills Container */}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedSkill.skillIndex === skillIndex ? 'max-h-[300px]' : 'max-h-0'
                }`}
              >
                <div className="px-1 pb-1 space-y-0.5">
                  {skill.subskills.map((subskill, subIndex) => (
                    <div 
                      key={subIndex} 
                      className={`p-0.5 rounded text-xs transition-all duration-200 cursor-pointer ${
                        expandedSkill.subskillIndex === subIndex 
                          ? 'bg-blue-50 border border-blue-100' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSkill(prev => ({
                          skillIndex,
                          subskillIndex: prev.subskillIndex === subIndex ? null : subIndex
                        }));
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-medium text-gray-700 truncate pr-1">{subskill.name}</span>
                        <div className="flex-shrink-0 flex items-center gap-0.5">
                          <span className="text-[8px] font-bold text-gray-900">{subskill.score}</span>
                          <span className={`text-[7px] ${
                            expandedSkill.subskillIndex === subIndex ? 'rotate-180' : ''
                          }`}>▼</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-0.5 overflow-hidden mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            subskill.color === 'yellow' ? 'bg-yellow-400' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${subskill.score}%` }}
                        />
                      </div>
                      
                      {/* Expanded Details */}
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          expandedSkill.subskillIndex === subIndex 
                            ? 'max-h-48 mt-1 opacity-100' 
                            : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="pt-0.5 border-t border-gray-100 mt-0.5">
                          <div className="grid grid-cols-2 gap-0.5 text-[7px] text-gray-500">
                            <div className="truncate">Target:</div>
                            <div className="text-right font-medium">100</div>
                            
                            <div className="truncate">Updated:</div>
                            <div className="text-right font-medium">Today</div>
                            
                            <div className="truncate">Status:</div>
                            <div className="text-right font-medium">
                              {subskill.score > 70 ? 'Excellent' : subskill.score > 40 ? 'Good' : 'Needs Work'}
                            </div>
                          </div>
                          <button 
                            className="mt-0.5 w-full py-0.5 text-[7px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentDisplayPlan.plan.steps?.length > 0 && (
          <div className="mt-2">
            <h2 className="text-xs font-bold mb-1">Plan Steps</h2>
            <ol className="list-decimal list-inside space-y-0.5">
              {currentDisplayPlan.plan.steps
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((step, idx) => (
                  <li key={idx} className="text-gray-700 text-[9px]">
                    <span className="font-semibold">
                      Step {step.order || idx + 1}: {step.title || step.name || `Step ${idx + 1}`}
                    </span>
                    <span className="ml-1 px-1 py-0.5 rounded bg-gray-200 text-[8px] text-gray-700 inline-block w-fit">
                      {step.type ? step.type.charAt(0).toUpperCase() + step.type.slice(1) : ''}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 overflow-y-auto">
        <h3 className="text-[10px] font-semibold text-gray-800 mb-1.5 px-1">Students</h3>
        <div className="space-y-1">
          {allStudents.map((s) => {
            const studentPlan = allStudentDevelopmentPlans.find(plan => plan.student === s._id);
            
            return (
              <div
                key={s._id}
                onClick={() => handleStudentSelect(s._id)}
                className={`cursor-pointer bg-white rounded p-1 shadow-sm transition-all duration-300 border 
                  ${s._id === selectedStudent?._id
                    ? 'border-cyan-500 ring-1 ring-cyan-300'
                    : 'hover:shadow-md hover:border-gray-300'}
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <div className="text-[9px] font-semibold truncate">{s.firstName} {s.lastName}</div>
                      {s.performance === 'Excellent' && (
                        <span className="inline-flex items-center px-0.5 py-0.5 rounded-full text-[7px] font-medium bg-green-100 text-green-800">
                          {s.performance}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-0.5 flex items-center text-[8px] text-gray-600">
                      <span className="inline-flex items-center">
                        <span className="w-1 h-1 rounded-full bg-blue-500 mr-0.5"></span>
                        OVR: {s.overall || 'N/A'}
                      </span>
                      {s.attendance !== undefined && (
                        <span className="ml-1 inline-flex items-center">
                          <span className="w-1 h-1 rounded-full bg-green-500 mr-0.5"></span>
                          {s.attendance}%
                        </span>
                      )}
                    </div>
                    
                    {studentPlan && (
                      <div className="mt-0.5">
                        <div className="flex justify-between text-[7px] text-gray-500 mb-0.5">
                          <span>Current Plan:</span>
                          <span className="font-medium">
                            {studentPlan.plan.performance || 'Standard'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-0.5 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${studentPlan.plan.progress || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[7px] text-gray-500 mt-0.5">
                          <span>Progress</span>
                          <span>{studentPlan.plan.progress || 0}%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-0.5 flex items-center justify-between text-[7px] text-gray-500">
                      <span>Engagement: {s.engagement}</span>
                      {s.assessments !== undefined && (
                        <span className="inline-flex items-center">
                          <span className="w-1 h-1 rounded-full bg-blue-500 mr-0.5"></span>
                          {s.assessments} assessments
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-1 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-[8px]">
                      {s.firstName?.[0]}{s.lastName?.[0]}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DevelopmentView;