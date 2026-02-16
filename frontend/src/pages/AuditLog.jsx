import { useState, useEffect } from 'react';
import api from '../api';
import ProtectedRoute from '../components/ProtectedRoute';
import '../styles/AuditLog.css';

const ACTION_ICONS = {
  COMPANY_CREATED: '🏢',
  USER_JOINED: '👋',
  USER_REMOVED: '🚫',
  PROJECT_CREATED: '📁',
  PROJECT_UPDATED: '✏️',
  PROJECT_DELETED: '🗑️',
  TASK_CREATED: '📋',
  TASK_UPDATED: '🔧',
  TASK_DELETED: '🗑️',
  TASK_ASSIGNED: '👤',
  TASK_STATUS_CHANGED: '🔄',
  COMMENT_ADDED: '💬',
  COMMENT_DELETED: '🗑️',
};

const ACTION_COLORS = {
  COMPANY_CREATED: '#4a90d9',
  USER_JOINED: '#28a745',
  USER_REMOVED: '#e74c3c',
  PROJECT_CREATED: '#4a90d9',
  PROJECT_UPDATED: '#f0ad4e',
  PROJECT_DELETED: '#e74c3c',
  TASK_CREATED: '#4a90d9',
  TASK_UPDATED: '#f0ad4e',
  TASK_DELETED: '#e74c3c',
  TASK_ASSIGNED: '#6f42c1',
  TASK_STATUS_CHANGED: '#17a2b8',
  COMMENT_ADDED: '#28a745',
  COMMENT_DELETED: '#e74c3c',
};

const ALL_ACTIONS = Object.keys(ACTION_ICONS);

const AuditLogInner = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const LIMIT = 30;

  useEffect(() => { fetchLogs(); }, [filter, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, skip: page * LIMIT };
      if (filter) params.action = filter;
      const res = await api.get('/activity-logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Audit Log</h1>
        <span className="header-subtitle">Activity history for your organization</span>
      </div>

      <div className="filters-bar">
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span className="filter-count">{total} entries</span>
      </div>

      {loading ? (
        <div className="loading-card">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <h3>No activity found</h3>
          <p>Activity logs will appear here as your team works.</p>
        </div>
      ) : (
        <div className="timeline">
          {logs.map((log, index) => (
            <div key={log._id || index} className="timeline-item">
              <div className="timeline-marker" style={{ borderColor: ACTION_COLORS[log.action] || '#999' }}>
                <span className="timeline-icon">{ACTION_ICONS[log.action] || '📌'}</span>
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-action" style={{ color: ACTION_COLORS[log.action] || '#666' }}>
                    {log.action?.replace(/_/g, ' ')}
                  </span>
                  <span className="timeline-time">{formatDate(log.createdAt)}</span>
                </div>
                <p className="timeline-description">{log.description}</p>
                <div className="timeline-footer">
                  <span className="timeline-actor">
                    by {log.performedBy?.name || 'System'}
                  </span>
                  {log.targetType && (
                    <span className="timeline-target">
                      on {log.targetType}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            &larr; Previous
          </button>
          <span className="page-info">Page {page + 1} of {totalPages}</span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
};

const AuditLog = () => (
  <ProtectedRoute roles={['ADMIN']}>
    <AuditLogInner />
  </ProtectedRoute>
);

export default AuditLog;
