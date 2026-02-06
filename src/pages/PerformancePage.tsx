import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { studentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types';
import StudentResults from '../components/student/StudentResults';

const PerformancePage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);

  const queryStudentId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('studentId') || '';
  }, [location.search]);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const data = await studentService.getStudents(selectedSubject?.id);
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        const defaultId = queryStudentId || list[0]?.id || '';
        setSelectedStudentId(defaultId);
      } catch (error) {
        console.error('Failed to load students for performance page:', error);
        setStudents([]);
        setSelectedStudentId('');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedSubject?.id, queryStudentId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-4">
        <h2 className="text-sm font-bold mb-3">Students</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : students.length > 0 ? (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                  selectedStudentId === student.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="text-sm font-medium truncate">
                  {student.firstName} {student.lastName}
                </span>
                <span className="text-xs text-gray-500">{student.overall ?? 0}%</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No students available.</div>
        )}
      </div>

      <div className="lg:col-span-9 col-span-12 bg-gray-50 rounded-lg shadow p-4">
        {selectedStudentId ? (
          <StudentResults studentId={selectedStudentId} selectedSubjectId={selectedSubject?.id} />
        ) : (
          <div className="text-sm text-gray-500">Select a student to view performance details.</div>
        )}
      </div>
    </div>
  );
};

export default PerformancePage;
