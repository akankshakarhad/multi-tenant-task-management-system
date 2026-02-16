import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';
import '../styles/Goals.css';

function formatMonth(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

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

const Goals = () => {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('history');

  // ── Shared data ──
  const [projects, setProjects] = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [allFeedback, setAllFeedback] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Assign form state ──
  const [formMembers, setFormMembers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [month, setMonth] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── History state ──
  const [selectedUserId, setSelectedUserId] = useState(null);

  // ── Inline feedback state ──
  const [feedbackGoalId, setFeedbackGoalId] = useState(null);
  const [fbRating, setFbRating] = useState(0);
  const [fbHoverRating, setFbHoverRating] = useState(0);
  const [fbComment, setFbComment] = useState('');
  const [fbTimeline, setFbTimeline] = useState(null);
  const [fbSubmitting, setFbSubmitting] = useState(false);

  // Fetch projects, goals, feedback, and team members on mount
  useEffect(() => {
    if (!user || user.role !== 'MANAGER') return;
    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [projRes, goalsRes, usersRes, fbRes] = await Promise.all([
          api.get('/projects', { params: { limit: 200 } }),
          api.get('/goals'),
          api.get('/users'),
          api.get('/feedback'),
        ]);
        setProjects(projRes.data.data || []);
        setAllGoals(goalsRes.data.data || []);
        setAllFeedback(fbRes.data.data || []);
        const usersArray = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.data || [];
        const members = usersArray.filter(
          (u) => u.role === 'MEMBER' && u._id !== user._id
        );
        setTeamMembers(members);
      } catch {
        // silent
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user]);

  // Update form member list when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setFormMembers([]);
      setSelectedMemberId('');
      return;
    }
    const project = projects.find((p) => p._id === selectedProjectId);
    if (!project) return;
    const memberUsers = (project.members || []).filter(
      (m) => m.role === 'MEMBER' && m._id !== user?._id
    );
    setFormMembers(memberUsers);
    setSelectedMemberId('');
  }, [selectedProjectId, projects, user]);

  // Goals for selected member in history view
  const selectedMemberGoals = useMemo(() => {
    if (!selectedUserId) return [];
    return allGoals.filter((g) => (g.user?._id || g.user) === selectedUserId);
  }, [selectedUserId, allGoals]);

  // Feedback lookup: key = "targetUserId:projectId" → feedback object
  const feedbackMap = useMemo(() => {
    const map = {};
    allFeedback.forEach((fb) => {
      const uid = fb.targetUser?._id || fb.targetUser;
      const pid = fb.project?._id || fb.project;
      if (uid && pid) map[`${uid}:${pid}`] = fb;
    });
    return map;
  }, [allFeedback]);

  const selectedTeamMember = teamMembers.find((m) => m._id === selectedUserId);

  const resetForm = () => {
    setSelectedProjectId('');
    setSelectedMemberId('');
    setMonth('');
    setTargetCount('');
    setDescription('');
  };

  const resetFeedbackForm = () => {
    setFeedbackGoalId(null);
    setFbRating(0);
    setFbHoverRating(0);
    setFbComment('');
    setFbTimeline(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedMemberId || !month || !targetCount) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/goals', {
        projectId: selectedProjectId,
        userId: selectedMemberId,
        month: month + '-01',
        targetCount: Number(targetCount),
        description: description.trim(),
      });
      const newGoal = res.data;
      const member = formMembers.find((m) => m._id === selectedMemberId);
      newGoal.user = member ? { _id: member._id, name: member.name } : { name: 'Unknown' };
      const project = projects.find((p) => p._id === selectedProjectId);
      if (project && !newGoal.project?.name) {
        newGoal.project = { _id: project._id, name: project.name };
      }
      setAllGoals((prev) => [newGoal, ...prev]);
      resetForm();
      toast.success('Goal assigned successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (goal) => {
    if (fbRating === 0) {
      toast.error('Please select a rating');
      return;
    }
    const targetUserId = goal.user?._id || goal.user;
    const projectId = goal.project?._id || goal.project;
    try {
      setFbSubmitting(true);
      const res = await api.post('/feedback', {
        targetUserId,
        projectId,
        rating: fbRating,
        comment: fbComment.trim(),
        completedInTimeline: fbTimeline,
      });
      setAllFeedback((prev) => [res.data, ...prev]);
      resetFeedbackForm();
      toast.success('Feedback submitted successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setFbSubmitting(false);
    }
  };

  const handleAddGoalForMember = () => {
    setActiveTab('assign');
  };

  const toggleFeedbackForm = (goalId) => {
    if (feedbackGoalId === goalId) {
      resetFeedbackForm();
    } else {
      setFeedbackGoalId(goalId);
      setFbRating(0);
      setFbHoverRating(0);
      setFbComment('');
      setFbTimeline(null);
    }
  };

  if (authLoading) return null;
  if (!user || user.role !== 'MANAGER') return <Navigate to="/dashboard" replace />;

  const selectedProject = projects.find((p) => p._id === selectedProjectId);
  const selectedFormMember = formMembers.find((m) => m._id === selectedMemberId);

  const activeFbRating = fbHoverRating || fbRating;

  return (
    <div className="page-container">
      <div className="goals-page">
        {/* Header row: title + tabs */}
        <div className="goals-header">
          <div className="goals-header-left">
            <h1 className="goals-page-title">Goals</h1>
            <p className="goals-page-subtitle">
              Manage targets &amp; feedback
            </p>
          </div>
          <div className="goals-tabs">
            <button
              className={`goals-tab ${activeTab === 'assign' ? 'goals-tab-active' : ''}`}
              onClick={() => setActiveTab('assign')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Assign
            </button>
            <button
              className={`goals-tab ${activeTab === 'history' ? 'goals-tab-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History
            </button>
          </div>
        </div>

        {/* ═══ Assign Goals Tab ═══ */}
        {activeTab === 'assign' && (
          <form className="goals-form-card" onSubmit={handleSubmit}>
            <div className="goals-form-row">
              <div className="goals-form-group">
                <label className="goals-label">Project</label>
                <select
                  className="goals-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="goals-form-group">
                <label className="goals-label">Team Member</label>
                {selectedProjectId && formMembers.length === 0 ? (
                  <p className="goals-empty-hint">No members found in this project</p>
                ) : (
                  <select
                    className="goals-select"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    disabled={!selectedProjectId}
                  >
                    <option value="">
                      {selectedProjectId ? 'Select a member...' : 'Select a project first'}
                    </option>
                    {formMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}{m.designation ? ` — ${m.designation}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="goals-form-row">
              <div className="goals-form-group">
                <label className="goals-label">Month</label>
                <input
                  type="month"
                  className="goals-input"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div className="goals-form-group">
                <label className="goals-label">Target Tasks</label>
                <input
                  type="number"
                  className="goals-input"
                  min="1"
                  placeholder="e.g. 10"
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                />
              </div>
            </div>

            <div className="goals-form-group goals-form-full">
              <label className="goals-label">Description <span className="goals-optional">(optional)</span></label>
              <textarea
                className="goals-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the member should focus on this month..."
                rows={3}
                maxLength={500}
              />
            </div>

            {selectedFormMember && targetCount && month && (
              <div className="goals-preview">
                <span className="goals-preview-label">Preview:</span>
                Assign <strong>{targetCount} tasks</strong> to{' '}
                <strong>{selectedFormMember.name}</strong> on{' '}
                <strong>{selectedProject?.name}</strong> for{' '}
                <strong>{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
              </div>
            )}

            <button
              type="submit"
              className="goals-submit-btn"
              disabled={submitting || !selectedProjectId || !selectedMemberId || !month || !targetCount}
            >
              {submitting ? 'Assigning...' : 'Assign Goal'}
            </button>
          </form>
        )}

        {/* ═══ Goals & Feedback History Tab ═══ */}
        {activeTab === 'history' && (
          <div className="goals-history-layout">
            {/* Left Panel: Member List */}
            <div className="goals-members-panel">
              <h3 className="goals-panel-title">Team Members</h3>
              {loadingData ? (
                <p className="goals-panel-loading">Loading...</p>
              ) : teamMembers.length === 0 ? (
                <p className="goals-panel-empty">No team members found.</p>
              ) : (
                <div className="goals-members-list">
                  {teamMembers.map((member) => {
                    const isSelected = selectedUserId === member._id;
                    return (
                      <button
                        key={member._id}
                        className={`goals-member-card ${isSelected ? 'goals-member-active' : ''}`}
                        onClick={() => setSelectedUserId(isSelected ? null : member._id)}
                      >
                        <div className="goals-member-avatar">
                          {(member.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="goals-member-info">
                          <span className="goals-member-name">{member.name}</span>
                          {member.designation && (
                            <span className="goals-member-designation">{member.designation}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Panel: Selected Member Goals + Feedback */}
            <div className="goals-detail-panel">
              {!selectedUserId ? (
                <div className="goals-detail-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <p>Select a team member to view their goals</p>
                </div>
              ) : (
                <>
                  {/* Member header with Add Goal */}
                  <div className="goals-detail-header">
                    <div className="goals-detail-member">
                      <div className="goals-detail-avatar">
                        {(selectedTeamMember?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="goals-detail-name">{selectedTeamMember?.name}</h3>
                        {selectedTeamMember?.designation && (
                          <span className="goals-detail-designation">{selectedTeamMember.designation}</span>
                        )}
                      </div>
                    </div>
                    <button className="goals-add-btn" onClick={handleAddGoalForMember}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Goal
                    </button>
                  </div>

                  {/* Goal cards */}
                  {selectedMemberGoals.length === 0 ? (
                    <div className="goals-detail-no-goals">
                      <p>No goals assigned yet.</p>
                      <button className="goals-add-btn" onClick={handleAddGoalForMember}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Assign First Goal
                      </button>
                    </div>
                  ) : (
                    <div className="goals-detail-list">
                      {selectedMemberGoals.map((goal) => {
                        const goalUserId = goal.user?._id || goal.user;
                        const goalProjectId = goal.project?._id || goal.project;
                        const fbKey = `${goalUserId}:${goalProjectId}`;
                        const existingFb = feedbackMap[fbKey];
                        const isFormOpen = feedbackGoalId === goal._id;

                        return (
                          <div className="goals-detail-card" key={goal._id}>
                            <div className="goals-detail-card-header">
                              <span className="goals-detail-project">{goal.project?.name || 'Unknown Project'}</span>
                              <span className="goals-detail-target">{goal.targetCount} tasks</span>
                            </div>
                            {goal.description && (
                              <p className="goals-detail-description">{goal.description}</p>
                            )}
                            <div className="goals-detail-card-footer">
                              <span className="goals-detail-month">{formatMonth(goal.month)}</span>
                              <span className="goals-detail-time">{timeAgo(goal.createdAt)}</span>
                            </div>

                            {/* Existing feedback display */}
                            {existingFb && (
                              <div className="goal-fb-existing">
                                <div className="goal-fb-existing-header">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                  <span className="goal-fb-existing-label">Your Feedback</span>
                                  <span className="goal-fb-existing-stars">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <span key={s} className={s <= existingFb.rating ? 'gfb-star gfb-star-filled' : 'gfb-star gfb-star-empty'}>
                                        &#9733;
                                      </span>
                                    ))}
                                  </span>
                                  {existingFb.completedInTimeline !== null && existingFb.completedInTimeline !== undefined && (
                                    <span className={`goal-fb-timeline-badge ${existingFb.completedInTimeline ? 'on-time' : 'delayed'}`}>
                                      {existingFb.completedInTimeline ? 'On time' : 'Delayed'}
                                    </span>
                                  )}
                                </div>
                                {existingFb.comment && (
                                  <p className="goal-fb-existing-comment">{existingFb.comment}</p>
                                )}
                              </div>
                            )}

                            {/* Give feedback button or inline form */}
                            {!existingFb && (
                              <>
                                {!isFormOpen ? (
                                  <button
                                    className="goal-fb-trigger-btn"
                                    onClick={() => toggleFeedbackForm(goal._id)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Give Feedback
                                  </button>
                                ) : (
                                  <div className="goal-fb-form">
                                    <div className="goal-fb-form-header">
                                      <span className="goal-fb-form-title">Feedback for {goal.project?.name}</span>
                                      <button
                                        className="goal-fb-close-btn"
                                        onClick={() => resetFeedbackForm()}
                                        type="button"
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="18" y1="6" x2="6" y2="18" />
                                          <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Star rating */}
                                    <div className="goal-fb-field">
                                      <label className="goal-fb-label">Rating</label>
                                      <div className="goal-fb-star-row">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button
                                            key={star}
                                            type="button"
                                            className={`goal-fb-star-btn ${star <= activeFbRating ? 'goal-fb-star-active' : ''}`}
                                            onClick={() => setFbRating(star)}
                                            onMouseEnter={() => setFbHoverRating(star)}
                                            onMouseLeave={() => setFbHoverRating(0)}
                                          >
                                            &#9733;
                                          </button>
                                        ))}
                                        {fbRating > 0 && (
                                          <span className="goal-fb-rating-text">{fbRating}/5</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Timeline toggle */}
                                    <div className="goal-fb-field">
                                      <label className="goal-fb-label">Completed on time?</label>
                                      <div className="goal-fb-toggle-group">
                                        <button
                                          type="button"
                                          className={`goal-fb-toggle ${fbTimeline === true ? 'goal-fb-toggle-yes' : ''}`}
                                          onClick={() => setFbTimeline(fbTimeline === true ? null : true)}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          className={`goal-fb-toggle ${fbTimeline === false ? 'goal-fb-toggle-no' : ''}`}
                                          onClick={() => setFbTimeline(fbTimeline === false ? null : false)}
                                        >
                                          No
                                        </button>
                                      </div>
                                    </div>

                                    {/* Comment */}
                                    <div className="goal-fb-field">
                                      <label className="goal-fb-label">
                                        Comment <span className="goals-optional">(optional)</span>
                                      </label>
                                      <textarea
                                        className="goal-fb-textarea"
                                        value={fbComment}
                                        onChange={(e) => setFbComment(e.target.value)}
                                        placeholder="Share your thoughts on their performance..."
                                        rows={3}
                                        maxLength={1000}
                                      />
                                    </div>

                                    {/* Submit */}
                                    <button
                                      type="button"
                                      className="goal-fb-submit-btn"
                                      disabled={fbSubmitting || fbRating === 0}
                                      onClick={() => handleFeedbackSubmit(goal)}
                                    >
                                      {fbSubmitting ? 'Submitting...' : 'Submit Feedback'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Goals;
