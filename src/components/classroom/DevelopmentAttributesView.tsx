import React, { useEffect, useState } from 'react';
import { Student, StudentAttributes, Plan, DevelopmentPlan } from '../../types';
import { User } from 'lucide-react';
import { developmentService } from '../../services/api';

interface DevelopmentAttributesViewProps {
  student: Student;
}

const DevelopmentAttributesView: React.FC<DevelopmentAttributesViewProps> = ({ student }) => {
  const [attributes, setAttributes] = useState<StudentAttributes | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the student's active plan (if any)
        const plans: DevelopmentPlan[] = await developmentService.getAllPlansForStudent(student._id, 'Active');
        const activePlan = plans && plans.length > 0 ? plans[0].plan : null;
        setPlan(activePlan);
        // If the student is enrolled in courses, use the first course for attributes (or adjust as needed)
        const courseId = student.courses && student.courses.length > 0 ? student.courses[0] : null;
        if (courseId) {
          const attrs = await developmentService.getStudentAttributes(student._id, courseId);
          setAttributes(attrs);
        } else {
          setAttributes(null);
        }
      } catch (err: any) {
        setError('Failed to load development data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [student]);

  if (loading) {
    // Reduced padding and font
    return <div className="p-4 text-sm">Loading development data...</div>;
  }

  if (error) {
    // Reduced padding and font
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    // 1. Set max height, reduced padding, and enable scrolling
    <div className="bg-white rounded-lg shadow-md p-2 max-h-[400px] overflow-y-auto">
      {/* 2. Header with reduced font sizes and sticky position */}
      <div className="flex items-center mb-4 sticky top-0 bg-white z-10 p-2 border-b">
        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{student.firstName}</h2>
          <p className="text-base">{student.lastName}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xl font-bold">{student.overall}</div>
          <div className="text-sm text-gray-500">OVR</div>
        </div>
      </div>

      {/* Plan Progress - reduced vertical padding and font */}
      <div className="mb-2 border-t border-b py-2">
        <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
          <div className="text-base font-semibold text-gray-700">{plan ? plan.name : 'No Plan Assigned'}</div>
          <div className="flex items-center space-x-1 w-full">
            <span className="text-xs text-gray-500 w-6 text-right">{student.overall}</span>
            <div className="relative flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute h-full bg-green-400" style={{ width: `${plan?.progress ?? 0}%` }}></div>
              {/* NOTE: Check your plan progress logic; the opacity-100 style seems unusual and may require review */}
              <div className="absolute h-full bg-white-500 opacity-100 " style={{ width: `${student.overall}%` }}></div>
              <div className="absolute h-full bg-green-400 opacity-20" style={{ width: `${plan?.potentialOverall ?? 0}%` }}></div>
            </div>
            <span className="text-xs text-gray-500 w-6 text-left">{plan?.potentialOverall ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Attributes - reduced spacing and font size on heading */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-gray-700 mb-2">Attributes</h3>
        {attributes && Array.isArray(attributes) && attributes.length > 0 ? (
          attributes.map((attr: any) => {
            // Fallback: use attr.attribute.name if attr.name is missing
            const label = attr.name || (attr.attribute && attr.attribute.name) || 'Attribute';
            return (
              <div key={attr._id} className="grid grid-cols-[150px_1fr] gap-2 items-center"> {/* Reduced gap */}
                <div className="text-sm font-medium text-gray-700">
                  {label}
                </div>
                <div className="flex items-center space-x-1 w-full">
                  <span className="text-xs text-gray-500 w-6 text-right">{attr.current}</span>
                  <div className="relative flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="absolute h-full bg-blue-500" style={{ width: `${attr.current}%` }}></div>
                    <div className="absolute h-full bg-green-400 opacity-30" style={{ width: `${attr.potential}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-left">{attr.potential}</span>
                </div>
              </div>
            );
          })
        ) : attributes && Object.entries(attributes).length > 0 ? (
          Object.entries(attributes).map(([label, { current, potential }]) => (
            <div key={label} className="grid grid-cols-[150px_1fr] gap-2 items-center"> {/* Reduced gap */}
              <div className="text-sm font-medium text-gray-700">
                {label.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="flex items-center space-x-1 w-full">
                <span className="text-xs text-gray-500 w-6 text-right">{current}</span>
                <div className="relative flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-blue-500" style={{ width: `${current}%` }}></div>
                  <div className="absolute h-full bg-green-400 opacity-30" style={{ width: `${potential}%` }}></div>
                </div>
                <span className="text-xs text-gray-500 w-6 text-left">{potential}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-sm">No attributes found for this student.</div>
        )}
      </div>

      {/* Legend - reduced top margin */}
      <div className="mt-4 flex items-center justify-center text-xs text-gray-500">
        <div className="flex items-center pr-10 space-x-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-400 rounded-full opacity-50"></div>
          <span>Potential</span>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentAttributesView;