import React, { useEffect, useState } from 'react';
import { Music, Globe, Tag, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSongs } from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchSongs({ limit: 1 }),
      fetchSongs({ limit: 1, language: 'english' }),
      fetchSongs({ limit: 1, language: 'telugu' }),
      fetchSongs({ limit: 1, language: 'hindi' }),
    ]).then(([all, eng, tel, hin]) => {
      setStats({ total: all.total, english: eng.total, telugu: tel.total, hindi: hin.total });
    });
  }, []);

  return (
    <>
      <div className="admin-topbar">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/admin/songs/add"   className="btn btn-primary"><Music size={15}/> Add Song</Link>
          <Link to="/admin/bulk-import" className="btn btn-gold"><Globe size={15}/> Bulk Import</Link>
        </div>
      </div>

      {stats && (
        <div className="admin-stats">
          {[
            { label: 'Total Songs',    value: stats.total,   icon: Music,  color: '#7c3aed' },
            { label: 'English Songs',  value: stats.english, icon: Globe,  color: '#0ea5e9' },
            { label: 'Telugu Songs',   value: stats.telugu,  icon: Tag,    color: '#10b981' },
            { label: 'Hindi Songs',    value: stats.hindi,   icon: Eye,    color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="admin-stat">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={16} color={color} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              </div>
              <div className="value">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))',
        borderRadius: 'var(--radius-md)', padding: 28, color: '#fff', marginTop: 8,
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>
          Quick Start Guide
        </h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2.2, opacity: 0.85, fontSize: 14 }}>
          <li>Add songs one by one via <strong>Add Song</strong></li>
          <li>Or import hundreds at once via <strong>Bulk Import</strong> (Excel/CSV)</li>
          <li>Download the template first to see the required format</li>
          <li>Each song supports English, Telugu &amp; Hindi lyrics simultaneously</li>
          <li>Users search by title, lyrics, author or tags — all in real-time</li>
        </ol>
      </div>
    </>
  );
}