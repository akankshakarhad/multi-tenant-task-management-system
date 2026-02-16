import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import '../styles/Navbar.css';

const AUTH_ROUTES = ['/', '/signup'];

const Navbar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!user || AUTH_ROUTES.includes(location.pathname)) return null;

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
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
        {isManager && (
          <NavLink to="/goals" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Goals
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/audit-log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Audit Log
          </NavLink>
        )}
      </div>
      <div className="nav-user">
        <NotificationBell />
      </div>
    </nav>
  );
};

export default Navbar;
