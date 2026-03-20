import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { MarkAssignmentModal } from '../components/resources/MarkAssignmentModal';
import Sidebar from '../components/resources/Sidebar';
import { assessmentService, studentService, subjectService } from '../services/api';
import { Assessment, Student, Subject } from '../types';

const MarkAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (data && data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) {
      setStudents([]);
      setAssessments([]);
      return;
    }

    const loadContext = async () => {
      try {
        const [studentsData, assessmentsData] = await Promise.all([
          studentService.getStudents(selectedSubjectId).catch(() => []),
          assessmentService.getAssessmentsBySubjectId(selectedSubjectId).catch(() => []),
        ]);
        setStudents(studentsData || []);
        setAssessments(assessmentsData || []);
      } catch (error) {
        console.error('Failed to load marking context:', error);
        setStudents([]);
        setAssessments([]);
      }
    };

    loadContext();
  }, [selectedSubjectId]);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments/view')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="mark-assessment"
        recentUploads={[]}
      />
      <div className="flex-1 p-8 overflow-hidden flex flex-col">
        <div className="w-full flex-1 min-h-0">
          {isWorkspaceExpanded && <div className="fixed inset-0 bg-black/30 z-40" />}
          <div className={isWorkspaceExpanded ? 'fixed top-4 left-4 right-4 bottom-6 z-50' : 'h-full min-h-0'}>
            <div className={`${isWorkspaceExpanded ? 'bg-white rounded-lg shadow-2xl border border-slate-200 h-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col' : 'bg-white rounded-lg shadow h-full overflow-hidden flex flex-col'}`}>
              {isWorkspaceExpanded && (
                <button
                  onClick={() => setIsWorkspaceExpanded(false)}
                  className="absolute top-3 right-3 z-10 p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  aria-label="Collapse workspace"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  Marking Workspace
                </div>
                <button
                  onClick={() => setIsWorkspaceExpanded((prev) => !prev)}
                  className="p-2 rounded-full hover:bg-gray-100"
                  aria-label={isWorkspaceExpanded ? 'Collapse' : 'Expand'}
                >
                  {isWorkspaceExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <MarkAssignmentModal
                  embedded
                  subjects={subjects}
                  selectedSubjectId={selectedSubjectId}
                  onSubjectChange={setSelectedSubjectId}
                  students={students}
                  assessments={assessments}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkAssessmentPage;
