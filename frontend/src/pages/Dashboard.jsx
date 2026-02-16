import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage } from '../api';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchDashboard();
  }, [user]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <div className="page-container"><div className="loading-card">Loading...</div></div>;
  if (!user) return <Navigate to="/" replace />;

  const canCreate = ['ADMIN', 'MANAGER'].includes(user.role);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (d) => {
    if (!d) return 'No date';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const daysOverdue = (d) => {
    if (!d) return 0;
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="page-container">
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>{getGreeting()}, {user.name}</h1>
            <span className="company-badge">{user.companyName}</span>
            <span className={`role-badge role-${user.role?.toLowerCase()}`}>{user.role}</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Summary Cards */}
        <div className="stats-grid">
          <Link to="/projects" className="stat-card">
            <div className="stat-number">{data?.summary?.totalProjects ?? '-'}</div>
            <div className="stat-label">Projects</div>
          </Link>
          <Link to="/tasks" className="stat-card">
            <div className="stat-number">{data?.summary?.totalTasks ?? '-'}</div>
            <div className="stat-label">Total Tasks</div>
          </Link>
          <div className="stat-card stat-danger">
            <div className="stat-number">{data?.summary?.overdue ?? '-'}</div>
            <div className="stat-label">Overdue</div>
          </div>
          <div className="stat-card stat-info">
            <div className="stat-number">{data?.summary?.myOpenTasks ?? '-'}</div>
            <div className="stat-label">My Open Tasks</div>
          </div>
        </div>

        {/* Tasks by Status */}
        {data?.tasksByStatus && (
          <div className="section-card">
            <h3 className="section-title">Tasks by Status</h3>
            <div className="status-bar-container">
              {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKER'].map((status) => {
                const count = data.tasksByStatus[status] || 0;
                const total = data.summary.totalTasks || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="status-bar-item">
                    <div className="status-bar-header">
                      <span className={`status-badge status-${status.toLowerCase().replace('_', '-')}`}>
                        {status.replace('_', ' ')}
                      </span>
                      <span className="status-bar-count">{count}</span>
                    </div>
                    <div className="status-bar-track">
                      <div
                        className={`status-bar-fill status-fill-${status.toLowerCase().replace('_', '-')}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {canCreate && (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <Link to="/projects" className="btn btn-primary btn-sm">New Project</Link>
              <Link to="/tasks" className="btn btn-outline btn-sm">New Task</Link>
            </div>
          </div>
        )}

        {/* Two-column layout for My Tasks & Overdue */}
        <div className="dashboard-columns">
          {/* My Tasks */}
          <div className="section-card">
            <div className="section-header">
              <h3>My Tasks</h3>
              <Link to="/tasks" className="section-link">View all</Link>
            </div>
            {!data?.myTasks?.length ? (
              <p className="empty-text">No open tasks assigned to you</p>
            ) : (
              <div className="recent-list">
                {data.myTasks.map((task) => (
                  <Link to={`/tasks/${task._id}`} key={task._id} className="recent-item">
                    <div className="recent-item-info">
                      <span className="recent-item-title">{task.title}</span>
                      <span className="recent-item-project">{task.project?.name}</span>
                    </div>
                    <div className="recent-item-meta">
                      <span className={`status-badge status-${task.status?.toLowerCase().replace('_', '-')}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                      <span className={`priority-dot priority-${task.priority?.toLowerCase()}`} title={task.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Overdue Tasks */}
          <div className="section-card">
            <div className="section-header">
              <h3>Overdue Tasks</h3>
              {data?.overdueTasks?.length > 0 && (
                <span className="overdue-badge">{data.summary.overdue}</span>
              )}
            </div>
            {!data?.overdueTasks?.length ? (
              <p className="empty-text">No overdue tasks</p>
            ) : (
              <div className="recent-list">
                {data.overdueTasks.map((task) => (
                  <Link to={`/tasks/${task._id}`} key={task._id} className="recent-item overdue-item">
                    <div className="recent-item-info">
                      <span className="recent-item-title">{task.title}</span>
                      <span className="recent-item-project">
                        {task.project?.name} &middot; {task.assignedTo?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="recent-item-meta">
                      <span className="overdue-days">{daysOverdue(task.dueDate)}d late</span>
                      <span className="overdue-date">{formatDate(task.dueDate)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project Progress */}
        {data?.projectProgress?.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <h3>Project Progress</h3>
              <Link to="/projects" className="section-link">View all</Link>
            </div>
            <div className="project-progress-list">
              {data.projectProgress.map((proj) => (
                <Link to={`/projects/${proj._id}`} key={proj._id} className="progress-item">
                  <div className="progress-item-header">
                    <span className="progress-item-name">{proj.name}</span>
                    <span className="progress-item-pct">{proj.progress}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                  <div className="progress-item-footer">
                    <span>{proj.done} / {proj.total} tasks done</span>
                    <span className={`status-badge status-${proj.status?.toLowerCase()}`}>{proj.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
