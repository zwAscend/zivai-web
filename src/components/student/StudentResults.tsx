import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Award, Target, Calendar, FileText } from 'lucide-react';
import { Assessment, Result } from '../../types';
import { assessmentService } from '../../services/api';

interface StudentResultsProps {
  studentId: string;
  selectedSubjectId?: string;
}

interface AssessmentResult {
  assessment: Assessment;
  result: Result;
  difference: number;
}

const StudentResults: React.FC<StudentResultsProps> = ({ studentId, selectedSubjectId }) => {
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'semester' | 'month'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'Assignment' | 'Test' | 'Project' | 'Exam'>('all');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const assessments = selectedSubjectId
          ? await assessmentService.getAssessmentsBySubjectId(selectedSubjectId)
          : await assessmentService.getAssessments();

        const assessmentResults = await Promise.all(
          (assessments || []).map(async (assessment) => {
            const rawAssessment = assessment as any;
            const resultsForAssessment = await assessmentService.getResults(assessment.id, studentId).catch(() => []);
            return resultsForAssessment.map(result => {
              const assessmentType = rawAssessment.assessmentType || assessment.type || 'Test';
              const resourceId = typeof assessment.resource === 'string'
                ? assessment.resource
                : rawAssessment.resource?.id || '';
              const normalizedAssessment: Assessment = {
                id: assessment.id,
                name: assessment.name,
                description: assessment.description || '',
                type: assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1),
                maxScore: Number(assessment.maxScore ?? 100),
                weight: Number(rawAssessment.weightPct ?? assessment.weight ?? 0),
                dueDate: assessment.updatedAt ? new Date(assessment.updatedAt) : new Date(),
                subjectId: rawAssessment.subject?.id || assessment.subjectId || '',
                status: assessment.status || 'draft',
                isAIEnhanced: Boolean(rawAssessment.aiEnhanced),
                questions: [],
                resource: resourceId,
                createdBy: rawAssessment.createdBy || assessment.createdBy || '',
                lastModifiedBy: rawAssessment.lastModifiedBy || assessment.lastModifiedBy || '',
                createdAt: assessment.createdAt ? new Date(assessment.createdAt) : undefined,
                updatedAt: assessment.updatedAt ? new Date(assessment.updatedAt) : undefined,
              };

              const submittedDate = result.submittedDate ? new Date(result.submittedDate) : new Date();
              return {
                assessment: normalizedAssessment,
                result: {
                  ...result,
                  submittedDate,
                  createdAt: result.createdAt ? new Date(result.createdAt) : undefined,
                  updatedAt: result.updatedAt ? new Date(result.updatedAt) : undefined,
                } as Result,
                difference: Number(result.actualMark ?? 0) - Number(result.expectedMark ?? 0)
              };
            });
          })
        );

        const flattened = assessmentResults.flat();
        setResults(flattened);
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [studentId, selectedSubjectId]);

  // Filter results based on selected period and type
  const filteredResults = results.filter(result => {
    const typeMatch = selectedType === 'all' || result.assessment.type === selectedType;
    
    let periodMatch = true;
    if (selectedPeriod === 'semester') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      periodMatch = result.result.submittedDate >= sixMonthsAgo;
    } else if (selectedPeriod === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      periodMatch = result.result.submittedDate >= oneMonthAgo;
    }
    
    return typeMatch && periodMatch;
  });

  // Calculate statistics
  const totalAssessments = filteredResults.length;
  const averageScore = totalAssessments > 0 
    ? Math.round(filteredResults.reduce((sum, r) => sum + (r.result.actualMark / r.assessment.maxScore * 100), 0) / totalAssessments)
    : 0;
  const improvementCount = filteredResults.filter(r => r.difference > 0).length;
  const improvementRate = totalAssessments > 0 ? Math.round((improvementCount / totalAssessments) * 100) : 0;

  // Prepare chart data
  const chartData = filteredResults.map((result, index) => ({
    name: result.assessment.name.substring(0, 15) + '...',
    expected: Math.round((result.result.expectedMark / result.assessment.maxScore) * 100),
    actual: Math.round((result.result.actualMark / result.assessment.maxScore) * 100),
    date: result.result.submittedDate.toLocaleDateString(),
  }));

  const trendData = filteredResults.map((result, index) => ({
    assessment: index + 1,
    score: Math.round((result.result.actualMark / result.assessment.maxScore) * 100),
    name: result.assessment.name.substring(0, 10) + '...',
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="h-7 w-32 bg-blue-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-blue-50 rounded-lg p-4">
                <div className="h-4 w-24 bg-blue-100 rounded animate-pulse mb-2" />
                <div className="h-6 w-16 bg-blue-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-72 bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="h-5 w-40 bg-blue-100 rounded animate-pulse" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">My Results</h2>
            <p className="text-gray-600">Track your academic performance and progress</p>
          </div>
          
          <div className="flex gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="semester">This Semester</option>
              <option value="month">This Month</option>
            </select>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="Assignment">Assignments</option>
              <option value="Test">Tests</option>
              <option value="Project">Projects</option>
              <option value="Exam">Exams</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-800">{totalAssessments}</div>
              <div className="text-sm text-gray-500">Total Assessments</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-800">{averageScore}%</div>
              <div className="text-sm text-gray-500">Average Score</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-800">{improvementRate}%</div>
              <div className="text-sm text-gray-500">Above Expected</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Award className="w-8 h-8 text-yellow-500 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {filteredResults.filter(r => ['A+', 'A', 'A-'].includes(r.result.grade)).length}
              </div>
              <div className="text-sm text-gray-500">A Grades</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Comparison Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Expected vs Actual Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="expected" fill="#94a3b8" name="Expected %" />
              <Bar dataKey="actual" fill="#3b82f6" name="Actual %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="assessment" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Detailed Results</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResults.map((result) => (
                <tr key={result.result.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {result.assessment.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Weight: {result.assessment.weight}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {result.assessment.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-semibold">
                      {result.result.actualMark}/{result.assessment.maxScore}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({Math.round((result.result.actualMark / result.assessment.maxScore) * 100)}%)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      ['A+', 'A'].includes(result.result.grade) ? 'bg-green-100 text-green-800' :
                      ['A-', 'B+', 'B'].includes(result.result.grade) ? 'bg-blue-100 text-blue-800' :
                      ['B-', 'C+', 'C'].includes(result.result.grade) ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {result.result.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {result.difference > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                      ) : result.difference < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                      ) : (
                        <div className="w-4 h-4 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        result.difference > 0 ? 'text-green-600' :
                        result.difference < 0 ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {result.difference > 0 ? '+' : ''}{result.difference}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.result.submittedDate.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No results found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentResults;
