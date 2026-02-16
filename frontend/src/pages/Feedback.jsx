import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';
import '../styles/Feedback.css';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const Feedback = () => {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [completedInTimeline, setCompletedInTimeline] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects', { params: { limit: 200 } });
        setProjects(res.data.data || []);
      } catch {
        // silent
      }
    };
    if (user?.role === 'MANAGER') fetchProjects();
  }, [user]);

  // Fetch feedback history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const res = await api.get('/feedback');
        // Filter to only feedback given by this manager
        const myFeedback = (res.data.data || []).filter(
          (fb) => fb.givenBy?._id === user._id
        );
        setHistory(myFeedback);
      } catch {
        // silent
      } finally {
        setLoadingHistory(false);
      }
    };
    if (user?.role === 'MANAGER') fetchHistory();
  }, [user]);

  // When project changes, extract MEMBER-role users
  useEffect(() => {
    if (!selectedProjectId) {
      setMembers([]);
      setSelectedMemberId('');
      return;
    }
    const project = projects.find((p) => p._id === selectedProjectId);
    if (!project) return;
    const memberUsers = (project.members || []).filter(
      (m) => m.role === 'MEMBER' && m._id !== user._id
    );
    setMembers(memberUsers);
    setSelectedMemberId('');
  }, [selectedProjectId, projects, user]);

  const resetForm = () => {
    setSelectedProjectId('');
    setSelectedMemberId('');
    setRating(0);
    setHoverRating(0);
    setComment('');
    setCompletedInTimeline(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedMemberId || rating === 0) {
      toast.error('Please select a project, member, and rating');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/feedback', {
        targetUserId: selectedMemberId,
        projectId: selectedProjectId,
        rating,
        comment: comment.trim(),
        completedInTimeline,
      });
      toast.success('Feedback submitted successfully');
      setHistory((prev) => [res.data, ...prev]);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;
  if (!user || user.role !== 'MANAGER') return <Navigate to="/dashboard" replace />;

  const activeRating = hoverRating || rating;
  const selectedProject = projects.find((p) => p._id === selectedProjectId);
  const selectedMember = members.find((m) => m._id === selectedMemberId);

  return (
    <div className="page-container">
      <div className="feedback-page">
        <h1 className="feedback-page-title">Give Feedback</h1>
        <p className="feedback-page-subtitle">
          Rate your team members on their project performance
        </p>

        {/* Feedback Form */}
        <form className="feedback-form-card" onSubmit={handleSubmit}>
          {/* Project Selection */}
          <div className="fb-form-group">
            <label className="fb-label">Project</label>
            <select
              className="fb-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Select a project...</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Member Selection */}
          <div className="fb-form-group">
            <label className="fb-label">Team Member</label>
            {selectedProjectId && members.length === 0 ? (
              <p className="fb-empty-hint">No members found in this project</p>
            ) : (
              <select
                className="fb-select"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                disabled={!selectedProjectId}
              >
                <option value="">
                  {selectedProjectId ? 'Select a member...' : 'Select a project first'}
                </option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} {m.designation ? `— ${m.designation}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Star Rating */}
          <div className="fb-form-group">
            <label className="fb-label">Rating</label>
            <div className="fb-star-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`fb-star ${star <= activeRating ? 'fb-star-active' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  &#9733;
                </button>
              ))}
              {rating > 0 && (
                <span className="fb-rating-text">{rating} / 5</span>
              )}
            </div>
          </div>

          {/* Completed on time toggle */}
          <div className="fb-form-group">
            <label className="fb-label">Completed tasks on time?</label>
            <div className="fb-toggle-group">
              <button
                type="button"
                className={`fb-toggle-btn ${completedInTimeline === true ? 'fb-toggle-active fb-toggle-yes' : ''}`}
                onClick={() => setCompletedInTimeline(completedInTimeline === true ? null : true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`fb-toggle-btn ${completedInTimeline === false ? 'fb-toggle-active fb-toggle-no' : ''}`}
                onClick={() => setCompletedInTimeline(completedInTimeline === false ? null : false)}
              >
                No
              </button>
            </div>
          </div>

          {/* Comment */}
          <div className="fb-form-group">
            <label className="fb-label">Comment <span className="fb-optional">(optional)</span></label>
            <textarea
              className="fb-textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts on their performance..."
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Preview */}
          {selectedMember && rating > 0 && (
            <div className="fb-preview">
              <span className="fb-preview-label">Preview:</span>
              Giving <strong>{selectedMember.name}</strong> a rating of{' '}
              <strong>{rating}/5</strong> on <strong>{selectedProject?.name}</strong>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="fb-submit-btn"
            disabled={submitting || !selectedProjectId || !selectedMemberId || rating === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>

        {/* Feedback History */}
        <div className="feedback-history">
          <h2 className="feedback-history-title">Your Feedback History</h2>
          {loadingHistory ? (
            <p className="fb-loading">Loading...</p>
          ) : history.length === 0 ? (
            <p className="fb-empty-history">You haven't given any feedback yet.</p>
          ) : (
            <div className="fb-history-list">
              {history.map((fb) => (
                <div className="fb-history-card" key={fb._id}>
                  <div className="fb-history-header">
                    <div className="fb-history-left">
                      <span className="fb-history-avatar">
                        {(fb.targetUser?.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <span className="fb-history-name">{fb.targetUser?.name || 'Unknown'}</span>
                        <span className="fb-history-project">{fb.project?.name || 'Unknown Project'}</span>
                      </div>
                    </div>
                    <div className="fb-history-right">
                      <span className="fb-history-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= fb.rating ? 'star star-filled' : 'star star-empty'}>
                            &#9733;
                          </span>
                        ))}
                      </span>
                      {fb.completedInTimeline !== null && (
                        <span className={`fb-timeline-badge ${fb.completedInTimeline ? 'on-time' : 'delayed'}`}>
                          {fb.completedInTimeline ? 'On time' : 'Delayed'}
                        </span>
                      )}
                    </div>
                  </div>
                  {fb.comment && <p className="fb-history-comment">{fb.comment}</p>}
                  <span className="fb-history-time">{timeAgo(fb.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feedback;
