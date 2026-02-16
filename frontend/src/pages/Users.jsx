import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/Auth.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { user, token, loading } = useAuth();

  useEffect(() => {
    if (token) {
      fetchUsers();
    } else {
      setLoadingUsers(false);
    }
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveUser = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the team? This action cannot be undone.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove user');
    }
  };

  if (loading || loadingUsers) {
    return (
      <div className="welcome-container">
        <div className="welcome-card"><h2>Loading...</h2></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="welcome-container">
      <div className="users-card">
        <h2>Team Members</h2>
        <span className="company-badge">{user.companyName}</span>
        <p className="team-count">{users.length} member{users.length !== 1 ? 's' : ''}</p>

        <div className="users-list">
          {users.map((member) => (
            <div key={member._id} className="user-row">
              <div className="user-avatar">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">
                  {member.name}
                  {member._id === user._id && <span className="you-badge">You</span>}
                </div>
                <div className="user-meta">{member.designation} · <span className={`role-badge role-${member.role?.toLowerCase()}`}>{member.role}</span></div>
              </div>

              {isAdmin && member._id !== user._id ? (
                <div className="user-actions">
                  <select
                    className="role-select"
                    value={member.role}
                    onChange={(e) => handleRoleChange(member._id, e.target.value)}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => handleRemoveUser(member._id, member.name)}
                    title="Remove user"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="user-email">{member.email}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Users;
