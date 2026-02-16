import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/UserAvatar.css';

const AUTH_ROUTES = ['/', '/signup'];

const UserAvatar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const avatarRef = useRef(null);

  const cancelLogout = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
  }, []);

  const startLogout = () => {
    setMenuOpen(false);
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      cancelLogout();
      logout();
      return;
    }

    timerRef.current = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [countdown, logout, cancelLogout]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user || AUTH_ROUTES.includes(location.pathname)) return null;

  const initial = user.name?.charAt(0).toUpperCase() || '?';

  return (
    <>
      <div className="user-avatar-float" ref={avatarRef}>
        <button
          className={`avatar-button ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title={user.name}
        >
          {initial}
        </button>

        {menuOpen && (
          <div className="avatar-menu">
            <div className="avatar-menu-header">
              <div className="avatar-menu-avatar">{initial}</div>
              <div className="avatar-menu-info">
                <span className="avatar-menu-name">{user.name}</span>
                <span className={`avatar-menu-role role-badge role-${user.role?.toLowerCase()}`}>
                  {user.role}
                </span>
              </div>
            </div>
            <div className="avatar-menu-divider" />
            <button
              className="avatar-menu-item"
              onClick={() => navigate('/profile')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </button>
            <button
              className="avatar-menu-item"
              onClick={() => navigate('/settings')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
            <div className="avatar-menu-divider" />
            <button
              className="avatar-menu-item avatar-menu-logout"
              onClick={startLogout}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>

      {countdown !== null && (
        <div className="logout-overlay">
          <div className="logout-modal">
            <div className="logout-countdown-ring">
              <svg viewBox="0 0 100 100">
                <circle className="logout-ring-bg" cx="50" cy="50" r="42" />
                <circle
                  className="logout-ring-progress"
                  cx="50" cy="50" r="42"
                  style={{ animationDuration: '1s' }}
                  key={countdown}
                />
              </svg>
              <span className="logout-countdown-number">{countdown}</span>
            </div>
            <p className="logout-text">Logging out...</p>
            <button className="logout-cancel-btn" onClick={cancelLogout}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
};

export default UserAvatar;
