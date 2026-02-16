import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage } from '../api';
import { useToast } from '../components/Toast';
import ProtectedRoute from '../components/ProtectedRoute';
import '../styles/Tasks.css';

function renderCommentText(text) {
  // Match @"Quoted Name" or @SingleName
  const parts = text.split(/(@"[^"]+"|@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@"') && part.endsWith('"')) {
      return <strong key={i} className="mention-highlight">{part.slice(1).replace(/^"|"$/g, '')}</strong>;
    }
    if (part.startsWith('@') && part.length > 1) {
      return <strong key={i} className="mention-highlight">{part.slice(1)}</strong>;
    }
    return part;
  });
}

const STATUS_FLOW = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'TODO', 'BLOCKER'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS', 'BLOCKER'],
  DONE: ['TODO'],
  BLOCKER: ['TODO', 'IN_PROGRESS'],
};

const TaskDetailInner = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const commentsEndRef = useRef(null);
  const refreshRef = useRef(null);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef(null);
  const mentionListRef = useRef(null);

  const canManage = ['ADMIN', 'MANAGER'].includes(user.role);

  useEffect(() => {
    fetchAll();
    refreshRef.current = setInterval(fetchComments, 30000);
    return () => clearInterval(refreshRef.current);
  }, [id]);

  const fetchAll = async () => {
    try {
      const [taskRes, commentsRes, usersRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/comments?taskId=${id}`),
        api.get('/users'),
      ]);
      setTask(taskRes.data);
      setComments(commentsRes.data);
      setCompanyUsers(usersRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/comments?taskId=${id}`);
      setComments(res.data);
    } catch {
      // silent — background poll
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (task.status === 'BLOCKER' && !['ADMIN', 'MANAGER'].includes(user.role)) {
      toast.error('Only managers or admins can resolve blocked tasks');
      return;
    }
    try {
      await api.put(`/tasks/${id}`, { status: newStatus });
      toast.success('Status updated');
      fetchAll();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleAssign = async (userId) => {
    try {
      await api.patch(`/tasks/${id}/assign`, { assignedTo: userId || null });
      toast.success('Assignee updated');
      fetchAll();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (commentText.length > 5000) {
      setError('Comment is too long (max 5000 characters)');
      return;
    }
    setSubmitting(true);
    setError('');
    setShowMentions(false);
    try {
      await api.post('/comments', { taskId: id, text: commentText });
      setCommentText('');
      fetchComments();
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mention autocomplete logic ──────────────────────────────
  const filteredMentionUsers = companyUsers.filter((u) => {
    if (u._id === user._id) return false;
    if (!mentionQuery) return true;
    return u.name.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCommentText(value);

    // Check if we're in a mention context
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const query = textBeforeCursor.slice(atIndex + 1);
      const hasSpace = query.includes('\n');

      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || atIndex === 0) && !hasSpace) {
        setMentionStart(atIndex);
        setMentionQuery(query);
        setMentionIndex(0);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (mentionUser) => {
    const before = commentText.slice(0, mentionStart);
    const after = commentText.slice(mentionStart + 1 + mentionQuery.length);
    const nameNeedsQuotes = mentionUser.name.includes(' ');
    const mention = nameNeedsQuotes ? `@"${mentionUser.name}" ` : `@${mentionUser.name} `;
    const newText = before + mention + after;
    setCommentText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleCommentKeyDown = (e) => {
    if (!showMentions || filteredMentionUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredMentionUsers[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      toast.success('Comment deleted');
      fetchComments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="page-container"><div className="loading-card">Loading...</div></div>;
  if (!task) return null;

  const allowedStatuses = STATUS_FLOW[task.status] || [];

  return (
    <div className="page-container">
      <Link to="/tasks" className="back-link">&larr; Back to Tasks</Link>

      {error && <div className="error-message">{error}</div>}

      <div className="task-detail">
        <div className="task-detail-main">
          <div className="task-detail-header">
            <h1>{task.title}</h1>
            {canManage && (
              <button className="btn btn-danger btn-sm" onClick={handleDeleteTask}>Delete</button>
            )}
          </div>

          <div className="task-badges">
            <span className={`priority-badge priority-${task.priority?.toLowerCase()}`}>
              {task.priority}
            </span>
            <span className={`status-badge status-${task.status?.toLowerCase().replace('_', '-')}`}>
              {task.status?.replace('_', ' ')}
            </span>
            {task.project && (
              <Link to={`/projects/${task.project._id || task.project}`} className="project-link-badge">
                {task.project.name || 'Project'}
              </Link>
            )}
          </div>

          {task.description && (
            <div className="task-description">
              <h3>Description</h3>
              <p>{task.description}</p>
            </div>
          )}

          {/* Comments Section */}
          <div className="comments-section">
            <h3>Comments ({comments.length})</h3>
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="empty-text">No comments yet. Start the conversation.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id} className="comment-item">
                    <div className="comment-header">
                      <div className="comment-author">
                        <span className="user-avatar small">
                          {comment.author?.name?.charAt(0) || '?'}
                        </span>
                        <span className="comment-name">{comment.author?.name || 'Unknown'}</span>
                      </div>
                      <div className="comment-meta">
                        <span className="comment-time">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                        {canManage && (
                          <button
                            className="btn-icon btn-icon-danger small"
                            onClick={() => handleDeleteComment(comment._id)}
                            title="Delete comment"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="comment-text">{renderCommentText(comment.text)}</p>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <form className="comment-form" onSubmit={handleAddComment} noValidate>
              <div className="mention-wrapper">
                <textarea
                  ref={textareaRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Add a comment... (use @name to mention)"
                  maxLength={5000}
                  rows={3}
                  required
                />
                {showMentions && filteredMentionUsers.length > 0 && (
                  <div className="mention-dropdown" ref={mentionListRef}>
                    {filteredMentionUsers.slice(0, 6).map((u, i) => (
                      <div
                        key={u._id}
                        className={`mention-option ${i === mentionIndex ? 'active' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                        onMouseEnter={() => setMentionIndex(i)}
                      >
                        <span className="mention-avatar">{u.name.charAt(0)}</span>
                        <div className="mention-info">
                          <span className="mention-name">{u.name}</span>
                          <span className="mention-email">{u.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="task-detail-sidebar">
          <div className="sidebar-section">
            <h4>Status</h4>
            <div className="status-actions">
              {allowedStatuses.map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm btn-status status-btn-${s.toLowerCase().replace('_', '-')}`}
                  onClick={() => handleStatusChange(s)}
                >
                  Move to {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Assignee</h4>
            {canManage ? (
              <select
                className="sidebar-select"
                value={task.assignedTo?._id || ''}
                onChange={(e) => handleAssign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {companyUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            ) : (
              <div className="sidebar-value">
                {task.assignedTo ? (
                  <span className="assignee-chip">
                    <span className="assignee-avatar">{task.assignedTo.name?.charAt(0)}</span>
                    {task.assignedTo.name}
                  </span>
                ) : (
                  'Unassigned'
                )}
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h4>Priority</h4>
            <span className={`priority-badge priority-${task.priority?.toLowerCase()}`}>
              {task.priority}
            </span>
          </div>

          <div className="sidebar-section">
            <h4>Due Date</h4>
            <span className="sidebar-value">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}
            </span>
          </div>

          <div className="sidebar-section">
            <h4>Created By</h4>
            <span className="sidebar-value">{task.createdBy?.name || 'Unknown'}</span>
          </div>

          <div className="sidebar-section">
            <h4>Created</h4>
            <span className="sidebar-value">{new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskDetail = () => (
  <ProtectedRoute>
    <TaskDetailInner />
  </ProtectedRoute>
);

export default TaskDetail;
