// src/components/pages/NotFound.tsx
import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center p-4">
      <h1 className="text-4xl font-bold text-red-500 mb-4">404 - Page Not Found</h1>
      <p className="text-lg text-gray-700 mb-2">No match for <strong>{location.pathname}</strong></p>
      <Link to="/" className="text-blue-500 underline mt-4">
        Go back to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
