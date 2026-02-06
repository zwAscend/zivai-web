import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types';

const DevelopmentOverviewPage: React.FC = () => {
  const { selectedSubject } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const data = await studentService.getStudents(selectedSubject?.id);
        setStudents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load students for development overview:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedSubject?.id]);

  return (
    <div className="bg-gray-50 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Student Development</h2>
        <p className="text-sm text-gray-500">Select a student to view full plan details.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      ) : students.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => navigate(`/development/${student.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-400 hover:shadow transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Overall: {student.overall ?? 0}%</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">Click to view development plan</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No students available for development plans.</div>
      )}
    </div>
  );
};

export default DevelopmentOverviewPage;
