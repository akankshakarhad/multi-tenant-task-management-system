import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import '../styles/Navbar.css';

const AUTH_ROUTES = ['/', '/signup'];

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  const cancelLogout = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
  }, []);

  const startLogout = () => {
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

  if (!user || AUTH_ROUTES.includes(location.pathname)) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand-group">
          <div className="nav-brand">FlowDesk</div>
          {user.companyName && (
            <span className="nav-company-name">{user.companyName}</span>
          )}
        </div>
        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Projects
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Tasks
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Team
          </NavLink>
          {isAdmin && (
            <NavLink to="/audit-log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Audit Log
            </NavLink>
          )}
        </div>
        <div className="nav-user">
          <NotificationBell />
          <span className="nav-username">{user.name}</span>
          <span className={`nav-role role-badge role-${user.role?.toLowerCase()}`}>{user.role}</span>
          <button className="nav-logout" onClick={startLogout}>Logout</button>
        </div>
      </nav>

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

export default Navbar;
