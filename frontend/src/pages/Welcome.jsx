import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Welcome = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="welcome-container">
        <div className="welcome-card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <h1>Welcome, {user.name}!</h1>
        <span className="company-badge">{user.companyName}</span>

        <div className="user-details">
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">{user.email}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Designation</span>
            <span className="detail-value">{user.designation}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Age</span>
            <span className="detail-value">{user.age}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Gender</span>
            <span className="detail-value">{user.gender}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Role</span>
            <span className="detail-value">{user.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
