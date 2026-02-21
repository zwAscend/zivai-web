import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Student, StudentAttributes } from '../../types';
import { developmentService } from '../../services/api';
import { reportService, StudentReportResponse } from '../../services/reportService';
import { TrendingUp, Award, Target, Zap, CheckCircle, Clock } from 'lucide-react';

interface StudentStatsProps {
  student: Student;
  selectedSubjectId?: string;
}

type MetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  color: string;
};

// ✨ NEW: A more compact card for displaying a key metric.
const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center p-4 bg-slate-50 rounded-xl">
    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg mr-4 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

const StudentStats: React.FC<StudentStatsProps> = ({ student, selectedSubjectId }) => {
  const [attributes, setAttributes] = useState<StudentAttributes | null>(null);
  const [studentReport, setStudentReport] = useState<StudentReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttributes = async () => {
      const subjectId = selectedSubjectId && selectedSubjectId !== 'all'
        ? selectedSubjectId
        : ((student.subjects || [])
            .map((subject) => (typeof subject === 'string' ? subject : subject?.id))
            .find(Boolean) as string | undefined);
      if (subjectId) {
        try {
          const [attrs, report] = await Promise.all([
            developmentService.getStudentAttributes(student.id, subjectId).catch(() => null),
            reportService.getStudentReport(student.id, subjectId).catch(() => null),
          ]);
          setAttributes(attrs);
          setStudentReport(report);
        } catch (error) {
          console.error('Failed to fetch student attributes:', error);
          setStudentReport(null);
        }
      } else {
        setAttributes(null);
        setStudentReport(null);
      }
      setLoading(false);
    };
    fetchAttributes();
  }, [student.id, student.subjects, selectedSubjectId]);

  if (loading) {
    return (
      <div className="border border-slate-200 bg-white p-6 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-6 space-y-3">
              <div className="h-6 w-40 bg-slate-200 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-200 rounded" />
                ))}
              </div>
            </div>
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-6 space-y-2">
              <div className="h-6 w-36 bg-slate-200 rounded" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-200 rounded" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-3 border border-slate-200 bg-slate-50 rounded-lg p-6 space-y-3">
            <div className="h-6 w-32 bg-slate-200 rounded" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-4 w-44 bg-slate-200 rounded" />
                <div className="h-2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Helper to format attribute names nicely (e.g., "networkSecurity" -> "Network Security")
  const formatAttributeName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-5 gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* LEFT COLUMN */}
      <div className="lg:col-span-2 space-y-6">
        {/* Key Metrics */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Performance Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard icon={Award} label="Overall Score" value={student.overall} color="bg-blue-500" />
            <MetricCard icon={TrendingUp} label="Performance Level" value={student.performance} color="bg-green-500" />
            <MetricCard icon={Target} label="Key Strength" value={student.strength} color="bg-purple-500" />
            <MetricCard icon={Zap} label="Engagement" value={student.engagement} color="bg-orange-500" />
          </div>
        </div>

        {/* Recent Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Progress</h2>
          {studentReport?.assessments?.length ? (
            <div className="space-y-3">
              {studentReport.assessments.slice(0, 3).map((assessment) => (
                <div key={assessment.assessmentId || assessment.assessmentName} className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <p className="text-slate-600">
                    Completed{' '}
                    <span className="font-semibold text-slate-800">
                      {assessment.assessmentName || 'Assessment'}
                    </span>
                    {typeof assessment.percent === 'number' ? ` (${Math.round(assessment.percent)}%)` : ''}
                    .
                  </p>
                  <span className="ml-auto text-slate-400 text-xs">
                    {assessment.submittedAt ? new Date(assessment.submittedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center text-sm text-slate-600">
              <Clock className="w-4 h-4 text-amber-500 mr-3 flex-shrink-0" />
              <p>No recent submissions available for this subject.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Skill Breakdown</h2>
        {attributes ? (
            <div className="space-y-5">
                {Object.entries(attributes).map(([key, data]) => (
                    <div key={key}>
                        <div className="flex justify-between items-center mb-1.5">
                            <h3 className="font-semibold text-slate-700 text-sm">{formatAttributeName(key)}</h3>
                            <div className="flex items-center text-xs text-slate-500">
                                <TrendingUp className="w-3.5 h-3.5 mr-1 text-green-500" />
                                <span className="font-medium">{data.potential - data.current} pt potential</span>
                            </div>
                        </div>

                        {/* ✨ NEW: Combined Progress Bar */}
                        <div className="relative w-full bg-slate-200 rounded-full h-2.5">
                            {/* Potential Bar (in the back) */}
                            <div 
                                className="absolute top-0 left-0 h-2.5 rounded-full bg-green-200"
                                style={{ width: `${data.potential}%` }}
                            />
                            {/* Current Bar (on top) */}
                            <div 
                                className="absolute top-0 left-0 h-2.5 rounded-full bg-blue-500"
                                style={{ width: `${data.current}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>Current: <span className="font-bold text-blue-600">{data.current}</span></span>
                            <span>Potential: <span className="font-bold text-green-600">{data.potential}</span></span>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-center text-slate-500 py-8">No detailed skill attributes available.</p>
        )}
      </div>
    </motion.div>
  );
};

export default StudentStats;
