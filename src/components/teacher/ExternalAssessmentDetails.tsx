import React from 'react';
import { Badge } from '../ui/badge';
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface ExternalAssessmentDetailsProps {
  assessment: any;
}

const ExternalAssessmentDetails: React.FC<ExternalAssessmentDetailsProps> = ({ assessment }) => {
  if (!assessment || Object.keys(assessment).length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overall Assessment Summary */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-2">Overall Assessment Summary</h4>
        <p className="text-sm text-gray-700">{assessment.overall_feedback}</p>
        <div className="mt-4 flex items-center gap-2">
          <Badge className="bg-blue-500 text-white">
            Score: {assessment.marks_achieved} / {assessment.total_possible_marks}
          </Badge>
          <Badge className="bg-green-500 text-white">
            Percentage: {assessment.marks_percentage}%
          </Badge>
        </div>
      </div>
      
      {/* Strengths and Improvements */}
      {(assessment.strengths?.length > 0 || assessment.improvements?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessment.strengths?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h5 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Strengths
              </h5>
              <ul className="space-y-1">
                {assessment.strengths.map((strength: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assessment.improvements?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h5 className="font-medium text-orange-700 mb-2 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Areas for Improvement
              </h5>
              <ul className="space-y-1">
                {assessment.improvements.map((improvement: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Per-Question Breakdown */}
      {assessment.assessment_details && Object.keys(assessment.assessment_details).length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-4">Question-by-Question Feedback</h4>
          <div className="space-y-4">
            {Object.entries(assessment.assessment_details).map(([key, detail]: [string, any]) => (
              <div key={key} className="p-3 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-800 flex justify-between items-center mb-1">
                  <span className="text-blue-600">{key.replace('_', ' ').toUpperCase()}</span>
                  <Badge variant="outline" className="font-semibold text-sm">
                    {detail.awarded_marks} / {detail.max_marks} Marks
                  </Badge>
                </h5>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Feedback:</span> {detail.feedback}
                </p>
                {detail.improvement && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Improvement:</span> {detail.improvement}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalAssessmentDetails;