import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Music, PlusCircle, Upload, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/songs',        icon: Music,           label: 'Manage Songs' },
  { to: '/admin/songs/add',    icon: PlusCircle,      label: 'Add Song' },
  { to: '/admin/bulk-import',  icon: Upload,          label: 'Bulk Import' },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div style={{ fontSize: 24, marginBottom: 6 }}>✝</div>
          <div className="name">NCC Songs</div>
          <div className="sub">Admin Panel</div>
        </div>

        <nav>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '24px 20px 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginInline: 20, paddingTop: 20 }}>
          <a href="/" className="admin-nav-item" style={{ display: 'flex', borderLeft: 'none', borderRadius: 8, marginBottom: 6 }}>
            <Home size={16} /> View Site
          </a>
          {admin && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
              {admin.name} · {admin.role}
            </div>
          )}
          <button onClick={handleLogout} className="admin-nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}