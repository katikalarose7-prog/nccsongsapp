import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserAuthProvider } from './context/Userauthcontext';

import HomePage       from './pages/HomePage';
import AdminLogin     from './pages/AdminLogin';
import AdminLayout    from './pages/admin/AdminLayout';
import Dashboard      from './pages/admin/Dashboard';
import SongsAdmin     from './pages/admin/SongsAdmin';
import AddSong        from './pages/admin/AddSong';
import BulkImport     from './pages/admin/BulkImport';

import UserLogin       from './pages/Userlogin';
import VerifyEmail     from './pages/Verifyemail';
import ResetPassword   from './pages/Resetpassword';
import Account         from './pages/Account';
import PlaylistDetail  from './pages/Playlistdetail';
import { PrivacyPolicy, TermsOfUse, Contact } from './pages/Legalpages';

import './index.css';

const ProtectedAdminRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: 120 }} />;
  return admin ? children : <Navigate to="/admin/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <UserAuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: 'Inter, sans-serif', fontSize: 14 },
              success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
            }}
          />
          <Routes>
            {/* Public site */}
            <Route path="/"               element={<HomePage />} />
            <Route path="/login"          element={<UserLogin />} />
            <Route path="/verify-email"   element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/account"        element={<Account />} />
            <Route path="/account/playlists/:id" element={<PlaylistDetail />} />
            <Route path="/privacy"        element={<PrivacyPolicy />} />
            <Route path="/terms"          element={<TermsOfUse />} />
            <Route path="/contact"        element={<Contact />} />

            {/* Admin — login lives only behind the footer link, not the header */}
            <Route path="/admin/login"    element={<AdminLogin />} />
            <Route path="/admin"          element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
              <Route index                element={<Dashboard />} />
              <Route path="songs"         element={<SongsAdmin />} />
              <Route path="songs/add"     element={<AddSong />} />
              <Route path="songs/edit/:id" element={<AddSong />} />
              <Route path="bulk-import"   element={<BulkImport />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </UserAuthProvider>
    </AuthProvider>
  );
}