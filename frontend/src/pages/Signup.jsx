import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import '../styles/Auth.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
    age: '',
    gender: '',
    designation: '',
    role: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [companyExists, setCompanyExists] = useState(false);
  const [checkingCompany, setCheckingCompany] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [debounceTimer, setDebounceTimer] = useState(null);

  const checkCompany = useCallback((companyName) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!companyName.trim()) {
      setCompanyExists(false);
      return;
    }

    setCheckingCompany(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-company?companyName=${encodeURIComponent(companyName)}`);
        setCompanyExists(res.data.exists);
        if (!res.data.exists) {
          setFormData((prev) => ({ ...prev, role: '' }));
        }
      } catch {
        setCompanyExists(false);
      } finally {
        setCheckingCompany(false);
      }
    }, 400);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));

    if (name === 'companyName') {
      checkCompany(value);
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
    if (formData.companyName.length > 100) errors.companyName = 'Company name is too long';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (formData.name.length > 100) errors.name = 'Name is too long';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    else if (formData.password.length > 128) errors.password = 'Password is too long';
    if (!formData.age) errors.age = 'Age is required';
    else {
      const age = Number(formData.age);
      if (age < 16 || age > 100) errors.age = 'Age must be between 16 and 100';
    }
    if (!formData.gender) errors.gender = 'Gender is required';
    if (!formData.designation.trim()) errors.designation = 'Designation is required';
    if (formData.designation.length > 100) errors.designation = 'Designation is too long';
    if (companyExists && !formData.role) errors.role = 'Role is required';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const payload = { ...formData, age: Number(formData.age) };
      if (!companyExists) {
        delete payload.role;
      }
      await signup(payload);
      toast.success('Account created successfully!');
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h1>FlowDesk</h1>
          <p>Join your team today</p>
        </div>

        <div className="auth-illustration">
          <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Central board */}
            <rect x="100" y="50" width="200" height="200" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

            {/* Column headers */}
            <rect x="115" y="65" width="55" height="20" rx="6" fill="rgba(74,144,217,0.35)" />
            <rect x="115" y="68" width="40" height="5" rx="2.5" fill="rgba(255,255,255,0.4)" />

            <rect x="180" y="65" width="55" height="20" rx="6" fill="rgba(240,173,78,0.35)" />
            <rect x="180" y="68" width="35" height="5" rx="2.5" fill="rgba(255,255,255,0.4)" />

            <rect x="245" y="65" width="40" height="20" rx="6" fill="rgba(40,167,69,0.35)" />
            <rect x="248" y="68" width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.4)" />

            {/* Task cards in columns */}
            <rect x="115" y="95" width="55" height="35" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.12)" strokeWidth="1">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
            </rect>
            <rect x="123" y="103" width="35" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
            <rect x="123" y="112" width="25" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

            <rect x="115" y="138" width="55" height="35" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.12)" strokeWidth="1">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" begin="0.5s" repeatCount="indefinite" />
            </rect>
            <rect x="123" y="146" width="30" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
            <rect x="123" y="155" width="40" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

            <rect x="180" y="95" width="55" height="35" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.12)" strokeWidth="1">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" begin="1s" repeatCount="indefinite" />
            </rect>
            <rect x="188" y="103" width="40" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
            <rect x="188" y="112" width="30" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

            <rect x="245" y="95" width="40" height="35" rx="8" fill="rgba(40,167,69,0.15)" stroke="rgba(40,167,69,0.25)" strokeWidth="1">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" begin="1.5s" repeatCount="indefinite" />
            </rect>
            <path d="M258 108l3 3 7-7" stroke="rgba(40,167,69,0.6)" strokeWidth="2" strokeLinecap="round" />

            {/* Person 1 (left) */}
            <g>
              <animateTransform attributeName="transform" type="translate" values="0,0;5,-8;0,0" dur="4s" repeatCount="indefinite" />
              <circle cx="55" cy="130" r="22" fill="rgba(74,144,217,0.2)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              <circle cx="55" cy="124" r="8" fill="rgba(255,255,255,0.3)" />
              <path d="M40 152c0-8 6.7-12 15-12s15 4 15 12" fill="rgba(255,255,255,0.15)" />
            </g>

            {/* Person 2 (right) */}
            <g>
              <animateTransform attributeName="transform" type="translate" values="0,0;-5,-6;0,0" dur="5s" repeatCount="indefinite" />
              <circle cx="345" cy="140" r="22" fill="rgba(108,92,231,0.2)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              <circle cx="345" cy="134" r="8" fill="rgba(255,255,255,0.3)" />
              <path d="M330 162c0-8 6.7-12 15-12s15 4 15 12" fill="rgba(255,255,255,0.15)" />
            </g>

            {/* Connection lines */}
            <line x1="77" y1="130" x2="100" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="4 4">
              <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
            </line>
            <line x1="300" y1="140" x2="323" y2="140" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="4 4">
              <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
            </line>

            {/* Progress arc */}
            <circle cx="200" cy="270" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle cx="200" cy="270" r="18" fill="none" stroke="rgba(74,144,217,0.5)" strokeWidth="3" strokeDasharray="85 113" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 200 270" to="360 200 270" dur="6s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        <ul className="auth-features">
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </span>
            Secure multi-tenant workspace
          </li>
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </span>
            Real-time notifications
          </li>
          <li>
            <span className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
            </span>
            Role-based team management
          </li>
        </ul>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h2>Create Account</h2>
          <p className="subtitle">Join your team on FlowDesk</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Enter your company name"
                maxLength={100}
                required
              />
              {fieldErrors.companyName && <span className="field-error">{fieldErrors.companyName}</span>}
              {formData.companyName && !checkingCompany && !fieldErrors.companyName && (
                <div className={`company-hint ${companyExists ? 'hint-exists' : 'hint-new'}`}>
                  {companyExists
                    ? 'Joining existing company'
                    : 'New company — you will be the Admin'}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                maxLength={100}
                required
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                minLength={6}
                maxLength={128}
                required
              />
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="Age"
                  min={16}
                  max={100}
                  required
                />
                {fieldErrors.age && <span className="field-error">{fieldErrors.age}</span>}
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange} required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>Designation</label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="e.g. Software Engineer"
                maxLength={100}
                required
              />
              {fieldErrors.designation && <span className="field-error">{fieldErrors.designation}</span>}
            </div>

            {companyExists && (
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleChange} required>
                  <option value="">Select your role</option>
                  <option value="MANAGER">Manager</option>
                  <option value="MEMBER">Member</option>
                </select>
                {fieldErrors.role && <span className="field-error">{fieldErrors.role}</span>}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading || checkingCompany}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-link">
            Already have an account? <Link to="/">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
