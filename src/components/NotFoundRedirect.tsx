// src/components/NotFoundRedirect.tsx
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface Props {
  isAuthenticated: boolean;
}

const NotFoundRedirect: React.FC<Props> = ({ isAuthenticated }) => {
  const location = useLocation();

  useEffect(() => {
    console.log(`🚨 Unknown route attempted: "${location.pathname}". Redirecting...`);
  }, [location.pathname]);

  const destination = isAuthenticated ? '/dashboard' : '/login';

  return <Navigate to={destination} replace />;
};

export default NotFoundRedirect;
