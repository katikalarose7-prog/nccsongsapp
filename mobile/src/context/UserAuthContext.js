import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserMe, USER_TOKEN_KEY } from '../api';

const UserAuthContext = createContext(null);

/* Mirrors the web app's UserAuthContext — powers playlists, favourites
   synced to the account, listening history, recommendations, and email
   preferences. The mobile app does not include admin login at all;
   song management stays a web-only admin task. */
export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await AsyncStorage.getItem(USER_TOKEN_KEY);
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const d = await getUserMe();
      setUser(d.user);
    } catch {
      await AsyncStorage.removeItem(USER_TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const loginUser = async (token, data) => {
    await AsyncStorage.setItem(USER_TOKEN_KEY, token);
    setUser(data);
  };

  const logoutUser = async () => {
    await AsyncStorage.removeItem(USER_TOKEN_KEY);
    setUser(null);
  };

  return (
    <UserAuthContext.Provider value={{ user, loading, loginUser, logoutUser, refreshUser }}>
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);