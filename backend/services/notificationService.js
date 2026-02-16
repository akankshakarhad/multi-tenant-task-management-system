const Notification = require('../models/Notification');
const { sendNotificationEmail } = require('./emailService');

/**
 * Centralized notification service.
 *
 * Every helper creates one or more Notification documents and
 * optionally pushes them via Socket.io if `io` is available.
 *
 * `getIO()` is a lazy getter so the service can be required before
 * socket.io is initialized.
 */

let _io = null;

function setIO(io) {
  _io = io;
}

function getIO() {
  return _io;
}

function emit(recipientId, notification) {
  const io = getIO();
  if (io) {
    io.to(String(recipientId)).emit('notification', notification);
  }
}

/**
 * Create a notification and emit it in real-time.
 * Skips if recipient === triggeredBy (don't notify yourself).
 */
async function create({ recipient, type, message, company, companyId, triggeredBy, relatedType, relatedId }) {
  // Never notify yourself
  if (String(recipient) === String(triggeredBy)) return null;

  const notification = await Notification.create({
    recipient,
    type,
    message,
    company,
    companyId,
    triggeredBy,
    relatedType: relatedType || null,
    relatedId: relatedId || null,
  });

  const populated = await notification.populate([
    { path: 'triggeredBy', select: 'name email' },
  ]);

  emit(recipient, populated);

  // Send email notification (non-blocking, fails silently)
  sendNotificationEmail({ recipientId: recipient, type, message, relatedId });

  return populated;
}

// ── Trigger helpers ─────────────────────────────────────────

async function taskAssigned({ task, assignedToId, actor }) {
  return create({
    recipient: assignedToId,
    type: 'TASK_ASSIGNED',
    message: `${actor.name} assigned you to "${task.title}"`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Task',
    relatedId: task._id,
  });
}

async function taskStatusChanged({ task, oldStatus, newStatus, actor, notifyUserId }) {
  return create({
    recipient: notifyUserId,
    type: 'TASK_STATUS_CHANGED',
    message: `${actor.name} moved "${task.title}" from ${oldStatus} to ${newStatus}`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Task',
    relatedId: task._id,
  });
}

async function commentAdded({ task, comment, actor, notifyUserId }) {
  return create({
    recipient: notifyUserId,
    type: 'COMMENT_ADDED',
    message: `${actor.name} commented on "${task.title}"`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Task',
    relatedId: task._id,
  });
}

async function commentMentioned({ task, comment, actor, mentionedUserId }) {
  return create({
    recipient: mentionedUserId,
    type: 'COMMENT_MENTIONED',
    message: `${actor.name} mentioned you in a comment on "${task.title}"`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Task',
    relatedId: task._id,
  });
}

async function goalAssigned({ goal, project, userId, actor }) {
  const monthLabel = new Date(goal.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return create({
    recipient: userId,
    type: 'GOAL_ASSIGNED',
    message: `${actor.name} set a goal of ${goal.targetCount} tasks for you on "${project.name}" for ${monthLabel}`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Goal',
    relatedId: goal._id,
  });
}

async function feedbackReceived({ feedback, project, userId, actor }) {
  return create({
    recipient: userId,
    type: 'FEEDBACK_RECEIVED',
    message: `${actor.name} gave you ${feedback.rating}/5 feedback on "${project.name}"`,
    company: actor.company,
    companyId: actor.companyId,
    triggeredBy: actor._id,
    relatedType: 'Feedback',
    relatedId: feedback._id,
  });
}

module.exports = {
  setIO,
  getIO,
  create,
  taskAssigned,
  taskStatusChanged,
  commentAdded,
  commentMentioned,
  goalAssigned,
  feedbackReceived,
};
