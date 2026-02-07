// src/components/layout/MainLayout.tsx
import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

interface MainLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  portalType?: 'teacher' | 'admin';
  children?: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ activeTab, setActiveTab, portalType = 'teacher', children }) => {
  return (
    <div className="h-screen bg-blue-700 p-6 overflow-hidden">
      <div className="container mx-auto h-full flex flex-col">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} portalType={portalType} />
        <main className="animate-fadeIn flex-1 min-h-0 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
