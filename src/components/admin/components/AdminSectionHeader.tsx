import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AdminSectionHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const AdminSectionHeader: React.FC<AdminSectionHeaderProps> = ({ title, description, icon: Icon }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSectionHeader;
