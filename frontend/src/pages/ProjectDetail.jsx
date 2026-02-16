import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import ProtectedRoute from '../components/ProtectedRoute';
import '../styles/Projects.css';

const ProjectDetailInner = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '' });
  const [error, setError] = useState('');

  const canManage = ['ADMIN', 'MANAGER'].includes(user.role);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      const [projRes, taskRes, usersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks?projectId=${id}`),
        api.get('/users'),
      ]);
      setProject(projRes.data);
      const taskData = taskRes.data.data || taskRes.data;
      setTasks(Array.isArray(taskData) ? taskData : []);
      setCompanyUsers(usersRes.data);
      setEditForm({
        name: projRes.data.name,
        description: projRes.data.description || '',
        status: projRes.data.status,
      });
    } catch {
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    try {
      await api.post(`/projects/${id}/members`, { userIds: selectedUsers });
      setShowAddMember(false);
      setSelectedUsers([]);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add members');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${id}`, editForm);
      setShowEdit(false);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update project');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this project? This action cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  if (loading) return <div className="page-container"><div className="loading-card">Loading...</div></div>;
  if (!project) return null;

  const memberIds = project.members?.map((m) => (typeof m === 'string' ? m : m._id)) || [];
  const nonMembers = companyUsers.filter((u) => !memberIds.includes(u._id));

  return (
    <div className="page-container">
      <Link to="/projects" className="back-link">&larr; Back to Projects</Link>

      <div className="detail-header">
        <div>
          <h1>{project.name}</h1>
          <span className={`status-badge status-${project.status?.toLowerCase()}`}>{project.status}</span>
        </div>
        {canManage && (
          <div className="header-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <p className="detail-desc">{project.description || 'No description provided.'}</p>

      {/* Members Section */}
      <div className="section-card">
        <div className="section-header">
          <h3>Members ({project.members?.length || 0})</h3>
          {canManage && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddMember(true)}>
              + Add Member
            </button>
          )}
        </div>
        <div className="members-list">
          {project.members?.map((member) => {
            const m = typeof member === 'string'
              ? companyUsers.find((u) => u._id === member)
              : member;
            if (!m) return null;
            return (
              <div key={m._id} className="member-row">
                <div className="user-avatar">{m.name?.charAt(0).toUpperCase()}</div>
                <div className="member-info">
                  <span className="member-name">
                    {m.name}
                    {m._id === user._id && <span className="you-badge">You</span>}
                  </span>
                  <span className="member-meta">{m.designation || m.email}</span>
                </div>
                {canManage && m._id !== user._id && (
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemoveMember(m._id)} title="Remove">
                    &times;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="section-card">
        <div className="section-header">
          <h3>Tasks ({tasks.length})</h3>
          {canManage && <Link to={`/tasks?projectId=${id}`} className="btn btn-outline btn-sm">View All</Link>}
        </div>
        {tasks.length === 0 ? (
          <p className="empty-text">No tasks in this project yet.</p>
        ) : (
          <div className="task-mini-list">
            {tasks.slice(0, 10).map((task) => (
              <Link to={`/tasks/${task._id}`} key={task._id} className="task-mini-item">
                <span className={`priority-dot priority-${task.priority?.toLowerCase()}`} />
                <span className="task-mini-title">{task.title}</span>
                <span className={`status-badge status-${task.status?.toLowerCase().replace('_', '-')}`}>
                  {task.status?.replace('_', ' ')}
                </span>
              </Link>
            ))}
            {tasks.length > 10 && (
              <Link to={`/tasks?projectId=${id}`} className="view-all-link">
                View all {tasks.length} tasks &rarr;
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <Modal title="Add Members" onClose={() => { setShowAddMember(false); setSelectedUsers([]); }}>
          {nonMembers.length === 0 ? (
            <p className="empty-text">All company members are already in this project.</p>
          ) : (
            <>
              <div className="checkbox-list">
                {nonMembers.map((u) => (
                  <label key={u._id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u._id)}
                      onChange={(e) => {
                        setSelectedUsers(
                          e.target.checked
                            ? [...selectedUsers, u._id]
                            : selectedUsers.filter((id) => id !== u._id)
                        );
                      }}
                    />
                    <span>{u.name}</span>
                    <span className="checkbox-meta">{u.designation}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAddMembers}
                disabled={selectedUsers.length === 0}
              >
                Add {selectedUsers.length} Member{selectedUsers.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Edit Project Modal */}
      {showEdit && (
        <Modal title="Edit Project" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

const ProjectDetail = () => (
  <ProtectedRoute>
    <ProjectDetailInner />
  </ProtectedRoute>
);

export default ProjectDetail;
