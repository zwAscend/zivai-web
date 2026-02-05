import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AdminMetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accentClassName: string;
}

const AdminMetricCard: React.FC<AdminMetricCardProps> = ({ label, value, icon: Icon, accentClassName }) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-2xl font-bold text-gray-800">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accentClassName}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
};

export default AdminMetricCard;
