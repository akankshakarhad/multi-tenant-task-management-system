import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/Profile.css';

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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMonth(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function renderStars(rating, max = 5) {
  const filled = Math.round(rating);
  const stars = [];
  for (let i = 1; i <= max; i++) {
    stars.push(
      <span key={i} className={`star ${i <= filled ? 'star-filled' : 'star-empty'}`}>
        &#9733;
      </span>
    );
  }
  return stars;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildHeatmapData(activityHeatmap) {
  const countMap = {};
  (activityHeatmap || []).forEach(({ date, count }) => {
    countMap[date] = count;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // End on Saturday of current week
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  // Start 53 weeks back from the Sunday of end-week (~1 year)
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (53 * 7 - 1));

  const days = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    days.push({
      date: dateStr,
      count: countMap[dateStr] || 0,
      dayOfWeek: cursor.getDay(),
      isFuture: cursor > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count));

  days.forEach((d) => {
    if (d.isFuture || d.count === 0) {
      d.level = 0;
    } else {
      const ratio = d.count / maxCount;
      if (ratio <= 0.25) d.level = 1;
      else if (ratio <= 0.5) d.level = 2;
      else if (ratio <= 0.75) d.level = 3;
      else d.level = 4;
    }
  });

  // Group into weeks (columns)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Month labels
  const monthLabels = [];
  const seenMonths = new Set();
  weeks.forEach((week, colIndex) => {
    for (const day of week) {
      const dt = new Date(day.date + 'T00:00:00');
      const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (dt.getDate() <= 7 && !seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        monthLabels.push({ colIndex, label: MONTH_NAMES[dt.getMonth()] });
        break;
      }
    }
  });

  // Total contributions in the heatmap period
  const totalInPeriod = days.reduce((sum, d) => sum + d.count, 0);

  return { weeks, monthLabels, totalInPeriod };
}

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get('/profile');
        setProfileData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchProfile();
  }, [user]);

  const heatmapData = useMemo(() => {
    if (!profileData?.activityHeatmap) return null;
    return buildHeatmapData(profileData.activityHeatmap);
  }, [profileData]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="page-container">
        <div className="profile-loading">
          <div className="profile-loading-spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="profile-error"><p>{error}</p></div>
      </div>
    );
  }

  const {
    user: profileUser,
    analytics,
    monthlyGoals,
    feedback,
    overallRating,
    totalFeedbackCount,
  } = profileData;

  const initial = profileUser.name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="page-container">
      <div className="profile-page">

        {/* Section 1: User Header */}
        <div className="profile-header">
          <div className="profile-avatar-large">{initial}</div>
          <div className="profile-info">
            <h1 className="profile-name">{profileUser.name}</h1>
            <p className="profile-designation">{profileUser.designation}</p>
            <div className="profile-meta">
              <span className={`role-badge role-${profileUser.role?.toLowerCase()}`}>
                {profileUser.role}
              </span>
              {profileUser.companyName && (
                <span className="profile-company">{profileUser.companyName}</span>
              )}
              <span className="profile-since">
                Member since {formatDate(profileUser.createdAt)}
              </span>
            </div>
            {overallRating !== null && (
              <div className="profile-rating-summary">
                <span className="profile-stars">{renderStars(overallRating)}</span>
                <span className="profile-rating-number">{overallRating}</span>
                <span className="profile-rating-count">({totalFeedbackCount} reviews)</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Analytics Cards */}
        <div className="profile-stats-grid">
          <div className="profile-stat-card stat-completed">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-value">{analytics.tasksCompleted}</div>
            <div className="stat-label">Tasks Completed</div>
          </div>
          <div className="profile-stat-card stat-ontime">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-value">{analytics.onTimeCompletionRate}%</div>
            <div className="stat-label">On-Time Rate</div>
          </div>
          <div className="profile-stat-card stat-projects">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="stat-value">{analytics.activeProjects}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="profile-stat-card stat-contributions">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className="stat-value">{analytics.totalContributions}</div>
            <div className="stat-label">Contributions</div>
          </div>
        </div>

        {/* Section 3: Contribution Heatmap */}
        <div className="profile-section-card">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Contributions
            {heatmapData && heatmapData.totalInPeriod > 0 && (
              <span className="section-count">{heatmapData.totalInPeriod} in last year</span>
            )}
          </h3>
          {heatmapData && heatmapData.weeks.length > 0 ? (
            <div className="heatmap-container">
              <div className="heatmap-months">
                <div className="heatmap-day-label-spacer" />
                {heatmapData.weeks.map((_, colIndex) => {
                  const monthLabel = heatmapData.monthLabels.find(
                    (m) => m.colIndex === colIndex
                  );
                  return (
                    <div className="heatmap-month-cell" key={colIndex}>
                      {monthLabel ? monthLabel.label : ''}
                    </div>
                  );
                })}
              </div>
              <div className="heatmap-grid-wrapper">
                <div className="heatmap-day-labels">
                  <span></span>
                  <span>Mon</span>
                  <span></span>
                  <span>Wed</span>
                  <span></span>
                  <span>Fri</span>
                  <span></span>
                </div>
                <div className="heatmap-grid">
                  {heatmapData.weeks.map((week, colIndex) => (
                    <div className="heatmap-week" key={colIndex}>
                      {week.map((day) => (
                        <div
                          key={day.date}
                          className={`heatmap-cell heatmap-level-${day.isFuture ? 'future' : day.level}`}
                          onMouseEnter={(e) => {
                            if (day.isFuture) return;
                            const rect = e.target.getBoundingClientRect();
                            setTooltip({
                              date: day.date,
                              count: day.count,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="heatmap-legend">
                <span className="heatmap-legend-label">Less</span>
                <div className="heatmap-cell heatmap-level-0" />
                <div className="heatmap-cell heatmap-level-1" />
                <div className="heatmap-cell heatmap-level-2" />
                <div className="heatmap-cell heatmap-level-3" />
                <div className="heatmap-cell heatmap-level-4" />
                <span className="heatmap-legend-label">More</span>
              </div>
              {tooltip && (
                <div
                  className="heatmap-tooltip"
                  style={{
                    position: 'fixed',
                    left: tooltip.x,
                    top: tooltip.y,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                  }}
                >
                  <strong>
                    {tooltip.count} contribution{tooltip.count !== 1 ? 's' : ''}
                  </strong>
                  <span>
                    {' '}on {new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="empty-text">No activity data yet.</p>
          )}
        </div>

        {/* Section 4: Monthly Goals (hidden for managers) */}
        {user.role !== 'MANAGER' && (
        <div className="profile-section-card">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            Monthly Goals
          </h3>
          {monthlyGoals.length === 0 ? (
            <p className="empty-text">No goals set yet. Ask your manager to set monthly targets.</p>
          ) : (
            <div className="goals-list">
              {monthlyGoals.map((goal) => (
                <div className="goal-card" key={goal._id}>
                  <div className="goal-header">
                    <span className="goal-project">{goal.project?.name || 'Unknown Project'}</span>
                    <span className="goal-month">{formatMonth(goal.month)}</span>
                  </div>
                  {goal.description && (
                    <p className="goal-description">{goal.description}</p>
                  )}
                  <div className="goal-progress-text">
                    <span className="goal-count">
                      {goal.completedCount} / {goal.targetCount} tasks
                    </span>
                    <span className={`goal-percent ${goal.progress >= 100 ? 'goal-complete' : ''}`}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div className="goal-bar-track">
                    <div
                      className={`goal-bar-fill ${goal.progress >= 100 ? 'goal-bar-complete' : ''}`}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Feedback (hidden for managers) */}
        {user.role !== 'MANAGER' && (
        <div className="profile-section-card profile-feedback-section">
          <div className="section-header-row">
            <h3 className="section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              All Feedback
            </h3>
            {overallRating !== null && (
              <div className="feedback-overall">
                <span className="feedback-overall-stars">{renderStars(overallRating)}</span>
                <span className="feedback-overall-number">{overallRating} / 5</span>
              </div>
            )}
          </div>
          {feedback.length === 0 ? (
            <p className="empty-text">No feedback received yet.</p>
          ) : (
            <div className="feedback-list">
              {feedback.map((fb) => (
                <div className="feedback-card" key={fb._id}>
                  <div className="feedback-card-header">
                    <span className="feedback-project-name">{fb.project?.name || 'Unknown'}</span>
                    <span className="feedback-stars">{renderStars(fb.rating)}</span>
                  </div>
                  {fb.comment && <p className="feedback-comment">{fb.comment}</p>}
                  <div className="feedback-card-footer">
                    <span className="feedback-by">By {fb.givenBy?.name || 'Unknown'}</span>
                    {fb.completedInTimeline !== null && (
                      <span className={`feedback-timeline-badge ${fb.completedInTimeline ? 'on-time' : 'delayed'}`}>
                        {fb.completedInTimeline ? 'Completed on time' : 'Delayed'}
                      </span>
                    )}
                    <span className="feedback-date">{timeAgo(fb.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
