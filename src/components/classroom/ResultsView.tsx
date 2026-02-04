import React, { useEffect, useState } from 'react';
// Assuming Student, Assessment, and the new StudentAssessmentResult types are defined in '../../types'
import { Student, StudentAssessmentResult } from '../../types';
import { User } from 'lucide-react';
// Correctly import the service function
import { assessmentService } from '../../services/api';

interface ResultsViewProps {
  student: Student;
}

const ResultsView: React.FC<ResultsViewProps> = ({ student }) => {
  // Now, results will be an array of StudentAssessmentResult
  const [results, setResults] = useState<StudentAssessmentResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // You might want to calculate overall stats dynamically in the frontend
  // or have your backend return them. For now, I'll show how to calculate
  // a simple overall from the fetched results.
  const [overallStats, setOverallStats] = useState({
    expected: 0,
    actual: 0,
    grade: 'N/A'
  });

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Call the new service function
        const fetchedAssessmentsAndResults = await assessmentService.getStudentAssessmentsAndResults(student.id);
        setResults(fetchedAssessmentsAndResults);

        // Calculate overall stats if results are available
        if (fetchedAssessmentsAndResults.length > 0) {
          let totalWeightedExpected = 0;
          let totalWeightedActual = 0;
          let totalWeight = 0;

          fetchedAssessmentsAndResults.forEach(item => {
            const assessmentMaxScore = item.assessment.maxScore;
            const assessmentWeight = item.assessment.weight; // Assuming weight is 0-100 as per your model

            // Convert marks to be out of 100 for consistent calculation
            const expectedPercentage = (item.result.expectedMark / assessmentMaxScore) * 100;
            const actualPercentage = (item.result.actualMark / assessmentMaxScore) * 100;

            totalWeightedExpected += expectedPercentage * assessmentWeight;
            totalWeightedActual += actualPercentage * assessmentWeight;
            totalWeight += assessmentWeight;
          });

          let overallExpected = totalWeight > 0 ? totalWeightedExpected / totalWeight : 0;
          let overallActual = totalWeight > 0 ? totalWeightedActual / totalWeight : 0;

          let overallGrade = 'F';
          if (overallActual >= 75) overallGrade = 'A';
          else if (overallActual >= 65) overallGrade = 'B';
          else if (overallActual >= 50) overallGrade = 'C';
          else if (overallActual >= 45) overallGrade = 'D';
          else if (overallActual >= 35) overallGrade = 'E';

          setOverallStats({
            expected: parseFloat(overallExpected.toFixed(2)),
            actual: parseFloat(overallActual.toFixed(2)),
            grade: overallGrade
          });
        }

      } catch (err) {
        console.error('Failed to fetch results:', err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [student.id]);

  if (loading) {
    // Reduced padding
    return <div className="p-4 text-sm">Loading results...</div>;
  }

  if (error || !results || results.length === 0) {
    // Reduced padding and font
    return <div className="p-4 text-sm text-red-500">{error || 'No results found for this student.'}</div>;
  }

  return (
    // 1. Set max height and enable scrolling for the main container
    <div className="bg-white rounded-lg shadow-lg p-2 max-h-[400px] overflow-y-auto">
      <div className="flex items-center mb-4 sticky top-0 bg-white z-10 p-2 border-b">
        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          {/* 3. Reduced font sizes */}
          <h2 className="text-lg font-bold">{student.firstName}</h2>
          <p className="text-base">{student.lastName}</p>
        </div>
        <div className="ml-auto">
          {/* Reduced font sizes */}
          <span className="text-xl font-bold">{student.overall}</span>
          <span className="text-sm ml-2">OVR</span>
        </div>
      </div>

      <div className="bg-gray-100 rounded-lg p-1"> {/* Reduced inner padding */}
        <table className="w-full text-sm"> {/* 3. Apply text-sm to the entire table */}
          <thead>
            <tr className="text-left">
              {/* 4. Reduced cell padding to py-1.5 */}
              <th className="py-1.5 px-2">Assessment</th>
              <th className="py-1.5 px-2">Expected Mark</th>
              <th className="py-1.5 px-2">Actual Mark</th>
              <th className="py-1.5 px-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => {
              // Now `item` has both `assessment` and `result` properties
              const difference = item.result.actualMark - item.result.expectedMark;
              return (
                <tr key={item.assessment.id || index} className="border-t border-gray-200">
                  {/* 4. Reduced cell padding to py-1.5 */}
                  <td className="py-1.5 px-2">{item.assessment.name}</td>
                  <td className="py-1.5 px-2">{item.result.expectedMark}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center">
                      {item.result.actualMark}
                      <span
                        className={`ml-1 ${difference > 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {/* Reduced spacing */}
                        {difference > 0 ? '↑' : '↓'}
                        {Math.abs(difference)}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">{item.result.grade}</td>
                </tr>
              );
            })}
            {/* Overall row - now based on calculated overallStats */}
            <tr className="border-t border-gray-200 font-bold">
              {/* 4. Reduced cell padding to py-1.5 */}
              <td className="py-1.5 px-2">Overall</td>
              <td className="py-1.5 px-2">{overallStats.expected}</td>
              <td className="py-1.5 px-2">
                <div className="flex items-center">
                  {overallStats.actual}
                  <span className={`ml-1 ${overallStats.actual >= overallStats.expected ? 'text-green-500' : 'text-red-500'}`}>
                    {overallStats.actual >= overallStats.expected ? '↑' : '↓'}
                    {Math.abs(overallStats.actual - overallStats.expected).toFixed(2)}
                  </span>
                </div>
              </td>
              <td className="py-1.5 px-2">{overallStats.grade}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsView;
