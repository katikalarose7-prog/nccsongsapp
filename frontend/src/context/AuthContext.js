import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAdminMe, ADMIN_TOKEN_KEY } from '../services/api';

const AuthContext = createContext(null);

/* Admin-only auth context — used solely by the /admin section.
   Kept separate from UserAuthContext (regular site visitors) so an
   admin session can never be mistaken for, or leak into, a public
   user session and vice versa. */
export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      getAdminMe()
        .then((d) => setAdmin(d.admin))
        .catch(() => localStorage.removeItem(ADMIN_TOKEN_KEY))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginAdmin = (token, data) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setAdmin(data);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);