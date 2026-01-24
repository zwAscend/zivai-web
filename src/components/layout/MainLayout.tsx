// src/components/layout/MainLayout.tsx
import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

interface MainLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children?: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ activeTab, setActiveTab, children }) => {
  return (
    <div className="min-h-screen bg-blue-700 p-6">
      <div className="container mx-auto">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="animate-fadeIn">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
