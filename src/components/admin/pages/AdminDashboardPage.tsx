import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, GraduationCap, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminSectionHeader from '../components/AdminSectionHeader';
import AdminMetricCard from '../components/AdminMetricCard';
import { AdminSummary, adminService } from '../../../services/adminService';
import { useToast } from '../../ui/use-toast';

const emptySummary: AdminSummary = {
  totalUsers: 0,
  activeUsers: 0,
  inactiveUsers: 0,
  totalStudents: 0,
  totalTeachers: 0,
  totalAdmins: 0,
  totalSubjects: 0,
  activeSubjects: 0,
  totalClasses: 0,
  totalSchools: 0,
  totalClassSubjectLinks: 0,
  recentUsers: [],
};

const AdminDashboardSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md border border-gray-100 p-4">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="h-8 w-14 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 bg-white rounded-lg shadow-md p-5 space-y-3">
        <div className="h-6 w-52 bg-slate-200 rounded animate-pulse" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((__, colIndex) => (
              <div key={colIndex} className="h-8 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md p-5">
        <div className="h-6 w-36 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AdminDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<AdminSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const summaryData = await adminService.getSummary();
        setSummary(summaryData || emptySummary);
      } catch (err: any) {
        toast.error('Failed to load admin summary.');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  const metrics = useMemo(() => {
    return [
      { label: 'Students', value: summary.totalStudents, icon: GraduationCap, accent: 'bg-blue-600' },
      { label: 'Teachers', value: summary.totalTeachers, icon: BookOpen, accent: 'bg-blue-700' },
      { label: 'Subjects', value: summary.totalSubjects, icon: BookOpen, accent: 'bg-cyan-600' },
      { label: 'Classes', value: summary.totalClasses, icon: Building2, accent: 'bg-purple-600' },
    ];
  }, [summary]);

  return (
    <div className="space-y-4 mt-4">
      <AdminSectionHeader
        title="Admin Dashboard"
        description="System-wide view of users, subjects, classes, and key setup signals."
        icon={Shield}
      />

      {loading ? (
        <AdminDashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {metrics.map((item) => (
              <AdminMetricCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                accentClassName={item.accent}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white rounded-lg shadow-md p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Recently Created Users</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Roles</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentUsers.map((user) => (
                      <tr key={user.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || '-'}
                        </td>
                        <td className="py-2 pr-4">{user.email || '-'}</td>
                        <td className="py-2 pr-4">{user.roles?.join(', ') || '-'}</td>
                        <td className="py-2 pr-4">
                          <span className={user.active ? 'text-green-700' : 'text-red-700'}>
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                    {summary.recentUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-500">
                          No recent users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
                <Link
                  to="/admin/users"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-3 text-sm font-medium text-center"
                >
                  Manage Users
                </Link>
                <Link
                  to="/admin/subjects"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-3 text-sm font-medium text-center"
                >
                  Manage Subjects
                </Link>
                <Link
                  to="/admin/classes"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-4 py-3 text-sm font-medium text-center"
                >
                  Manage Classes
                </Link>
                <Link
                  to="/admin/edge-nodes"
                  className="bg-blue-700 hover:bg-blue-800 text-white rounded-md px-4 py-3 text-sm font-medium text-center"
                >
                  Manage Edge Nodes
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
