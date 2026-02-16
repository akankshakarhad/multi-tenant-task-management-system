const nodemailer = require('nodemailer');
const User = require('../models/User');

/**
 * Email notification service.
 *
 * Sends HTML emails for each notification type.
 * Disabled gracefully when SMTP env vars are not configured.
 */

let transporter = null;

function init() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[EmailService] SMTP not configured — email notifications disabled');
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: Number(port) === 465,
    auth: { user, pass },
  });

  transporter.verify()
    .then(() => console.log('[EmailService] SMTP connected — email notifications enabled'))
    .catch((err) => {
      console.error('[EmailService] SMTP connection failed:', err.message);
      transporter = null;
    });
}

/**
 * Build a styled HTML email body.
 */
function buildHTML({ heading, body, actionUrl, actionLabel }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:20px 28px;">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:0.5px;">TaskManager</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 28px;">
            <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:20px;">${heading}</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">${body}</p>
            ${actionUrl ? `
            <a href="${actionUrl}" style="display:inline-block;background:#4a90d9;color:#fff;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">
              ${actionLabel || 'View Details'}
            </a>` : ''}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #eee;color:#aaa;font-size:12px;">
            You received this because of your notification settings in TaskManager.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const FRONTEND_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Email content builders per notification type.
 */
const templates = {
  TASK_ASSIGNED: ({ message, relatedId }) => ({
    subject: 'You have been assigned a task',
    html: buildHTML({
      heading: 'New Task Assignment',
      body: message,
      actionUrl: `${FRONTEND_URL}/tasks/${relatedId}`,
      actionLabel: 'View Task',
    }),
  }),

  TASK_STATUS_CHANGED: ({ message, relatedId }) => ({
    subject: 'Task status updated',
    html: buildHTML({
      heading: 'Task Status Changed',
      body: message,
      actionUrl: `${FRONTEND_URL}/tasks/${relatedId}`,
      actionLabel: 'View Task',
    }),
  }),

  COMMENT_ADDED: ({ message, relatedId }) => ({
    subject: 'New comment on your task',
    html: buildHTML({
      heading: 'New Comment',
      body: message,
      actionUrl: `${FRONTEND_URL}/tasks`,
      actionLabel: 'View Task',
    }),
  }),

  COMMENT_MENTIONED: ({ message, relatedId }) => ({
    subject: 'You were mentioned in a comment',
    html: buildHTML({
      heading: 'You Were Mentioned',
      body: message,
      actionUrl: `${FRONTEND_URL}/tasks`,
      actionLabel: 'View Task',
    }),
  }),
};

/**
 * Send an email notification.
 * Resolves recipient's email from their userId.
 * Fails silently — email should never block the main flow.
 */
async function sendNotificationEmail({ recipientId, type, message, relatedId }) {
  if (!transporter) return;

  try {
    const recipient = await User.findById(recipientId).select('email name');
    if (!recipient?.email) return;

    const template = templates[type];
    if (!template) return;

    const { subject, html } = template({ message, relatedId });

    await transporter.sendMail({
      from: `"TaskManager" <${process.env.SMTP_USER}>`,
      to: recipient.email,
      subject,
      html,
    });
  } catch (err) {
    // Never let email failures break the app
    console.error('[EmailService] Failed to send:', err.message);
  }
}

module.exports = { init, sendNotificationEmail };
