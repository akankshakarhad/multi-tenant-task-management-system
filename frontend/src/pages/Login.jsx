import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { getErrorMessage } from '../api';
import '../styles/Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const validate = () => {
    if (!email.trim()) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email';
    if (!password) return 'Password is required';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="floating-shapes">
        <div className="floating-shape" />
        <div className="floating-shape" />
        <div className="floating-shape" />
        <div className="floating-shape" />
        <div className="floating-shape" />
        <div className="floating-shape" />
      </div>

      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1>FlowDesk</h1>
          <p>Manage your team's work, effortlessly</p>
        </div>

        <div className="auth-illustration">
          <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Clipboard */}
            <rect x="120" y="40" width="160" height="220" rx="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
            <rect x="160" y="28" width="80" height="24" rx="12" fill="rgba(74,144,217,0.4)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

            {/* Checklist items */}
            <rect x="148" y="85" width="22" height="22" rx="6" fill="rgba(74,144,217,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
            </rect>
            <path d="M153 96l4 4 8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" fill="freeze" />
              <animate attributeName="stroke-dasharray" from="20" to="20" dur="0.01s" fill="freeze" />
            </path>
            <rect x="182" y="90" width="80" height="10" rx="5" fill="rgba(255,255,255,0.2)" />

            <rect x="148" y="125" width="22" height="22" rx="6" fill="rgba(40,167,69,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" begin="0.5s" repeatCount="indefinite" />
            </rect>
            <path d="M153 136l4 4 8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="182" y="130" width="60" height="10" rx="5" fill="rgba(255,255,255,0.2)" />

            <rect x="148" y="165" width="22" height="22" rx="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" begin="1s" repeatCount="indefinite" />
            </rect>
            <rect x="182" y="170" width="70" height="10" rx="5" fill="rgba(255,255,255,0.15)" />

            <rect x="148" y="205" width="22" height="22" rx="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" begin="1.5s" repeatCount="indefinite" />
            </rect>
            <rect x="182" y="210" width="90" height="10" rx="5" fill="rgba(255,255,255,0.15)" />

            {/* Floating task card (top right) */}
            <g transform="translate(290, 60)">
              <animateTransform attributeName="transform" type="translate" values="290,60;295,50;290,60" dur="4s" repeatCount="indefinite" />
              <rect width="85" height="55" rx="10" fill="rgba(74,144,217,0.25)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <rect x="12" y="14" width="40" height="6" rx="3" fill="rgba(255,255,255,0.3)" />
              <rect x="12" y="28" width="60" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
              <circle cx="68" cy="42" r="4" fill="rgba(40,167,69,0.6)" />
            </g>

            {/* Floating task card (bottom left) */}
            <g transform="translate(25, 180)">
              <animateTransform attributeName="transform" type="translate" values="25,180;20,170;25,180" dur="5s" repeatCount="indefinite" />
              <rect width="80" height="50" rx="10" fill="rgba(108,92,231,0.2)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <rect x="12" y="12" width="50" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
              <rect x="12" y="26" width="35" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
              <circle cx="62" cy="38" r="4" fill="rgba(240,173,78,0.6)" />
            </g>

            {/* Person avatar 1 */}
            <g transform="translate(310, 190)">
              <animateTransform attributeName="transform" type="translate" values="310,190;315,185;310,190" dur="3.5s" repeatCount="indefinite" />
              <circle cx="20" cy="14" r="14" fill="rgba(74,144,217,0.3)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
              <circle cx="20" cy="10" r="5" fill="rgba(255,255,255,0.4)" />
              <path d="M10 28c0-5.5 4.5-8 10-8s10 2.5 10 8" fill="rgba(255,255,255,0.2)" />
            </g>
          </svg>
        </div>

        <ul className="auth-features">
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
            Team collaboration in real-time
          </li>
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            </span>
            Organize projects and tasks
          </li>
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </span>
            Track progress with insights
          </li>
        </ul>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h2>Welcome Back</h2>
          <p className="subtitle">Log in to your account</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="auth-link">
            Don't have an account? <Link to="/signup">Create Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
