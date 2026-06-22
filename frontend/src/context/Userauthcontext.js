import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserMe, USER_TOKEN_KEY } from '../services/api';

const UserAuthContext = createContext(null);

/* Auth context for regular signed-in site visitors (not admins).
   Powers playlists, favourites synced to the account, listening
   history, recommendations, and email preferences. */
export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(() => {
    const token = localStorage.getItem(USER_TOKEN_KEY);
    if (!token) { setUser(null); setLoading(false); return Promise.resolve(); }
    return getUserMe()
      .then((d) => setUser(d.user))
      .catch(() => { localStorage.removeItem(USER_TOKEN_KEY); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const loginUser = (token, data) => {
    localStorage.setItem(USER_TOKEN_KEY, token);
    setUser(data);
  };

  const logoutUser = () => {
    localStorage.removeItem(USER_TOKEN_KEY);
    setUser(null);
  };

  return (
    <UserAuthContext.Provider value={{ user, loading, loginUser, logoutUser, refreshUser }}>
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);