import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Student, StudentAttributes } from '../../types';
import { developmentService } from '../../services/api';
import { TrendingUp, Award, Target, Zap, CheckCircle, Clock } from 'lucide-react';

interface StudentStatsProps {
  student: Student;
}

// ✨ NEW: A more compact card for displaying a key metric.
const MetricCard = ({ icon: Icon, label, value, color }) => (
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

const StudentStats: React.FC<StudentStatsProps> = ({ student }) => {
  const [attributes, setAttributes] = useState<StudentAttributes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttributes = async () => {
      if (student.courses && student.courses.length > 0) {
        try {
          const attrs = await developmentService.getStudentAttributes(student._id, student.courses[0]);
          setAttributes(attrs);
        } catch (error) {
          console.error('Failed to fetch student attributes:', error);
        }
      }
      setLoading(false);
    };
    fetchAttributes();
  }, [student]);

  if (loading) {
    return (
      <div className="text-center p-6 bg-white rounded-xl shadow-sm">
        Loading statistics...
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
          <div className="space-y-3">
             {/* Example items - replace with dynamic data */}
            <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                <p className="text-slate-600">Improved <span className="font-semibold text-slate-800">Network Security</span> skill.</p>
                <span className="ml-auto text-slate-400 text-xs">1d ago</span>
            </div>
            <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                <p className="text-slate-600">Completed <span className="font-semibold text-slate-800">OSPF Lab</span> assignment.</p>
                <span className="ml-auto text-slate-400 text-xs">3d ago</span>
            </div>
             <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 text-amber-500 mr-3 flex-shrink-0" />
                <p className="text-slate-600">Assessment due for <span className="font-semibold text-slate-800">Routing</span>.</p>
                <span className="ml-auto text-slate-400 text-xs">in 2d</span>
            </div>
          </div>
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