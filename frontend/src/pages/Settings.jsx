import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Settings.css';

const Settings = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="page-container">
      <div className="settings-page">
        <h1 className="settings-title">Settings</h1>

        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <h3>Theme</h3>
          </div>
          <p className="settings-coming-soon">Theme customization coming soon.</p>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <h3>Notification Preferences</h3>
          </div>
          <p className="settings-coming-soon">Notification settings coming soon.</p>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h3>Account Security</h3>
          </div>
          <p className="settings-coming-soon">Password and security settings coming soon.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
