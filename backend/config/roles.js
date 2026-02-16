/**
 * Centralised RBAC permissions map.
 *
 * Each key is a permission string used in route guards via  permit('action').
 * The value is the array of roles that are allowed to perform that action.
 */

const ROLES = ['ADMIN', 'MANAGER', 'MEMBER'];

const PERMISSIONS = {
  // ── Users ─────────────────────────────────────────────
  'users:list':       ['ADMIN', 'MANAGER', 'MEMBER'],
  'users:read':       ['ADMIN', 'MANAGER', 'MEMBER'],
  'users:update-role': ['ADMIN'],
  'users:remove':     ['ADMIN'],

  // ── Projects ──────────────────────────────────────────
  'projects:create':  ['ADMIN', 'MANAGER'],
  'projects:list':    ['ADMIN', 'MANAGER', 'MEMBER'],
  'projects:read':    ['ADMIN', 'MANAGER', 'MEMBER'],
  'projects:update':        ['ADMIN', 'MANAGER'],
  'projects:delete':        ['ADMIN', 'MANAGER'],
  'projects:add-member':    ['ADMIN', 'MANAGER'],
  'projects:remove-member': ['ADMIN', 'MANAGER'],

  // ── Tasks ─────────────────────────────────────────────
  'tasks:create':     ['ADMIN', 'MANAGER'],
  'tasks:list':       ['ADMIN', 'MANAGER', 'MEMBER'],
  'tasks:read':       ['ADMIN', 'MANAGER', 'MEMBER'],
  'tasks:update':     ['ADMIN', 'MANAGER', 'MEMBER'],
  'tasks:assign':     ['ADMIN', 'MANAGER'],
  'tasks:delete':     ['ADMIN', 'MANAGER'],

  // ── Comments ──────────────────────────────────────────
  'comments:create':  ['ADMIN', 'MANAGER', 'MEMBER'],
  'comments:list':    ['ADMIN', 'MANAGER', 'MEMBER'],
  'comments:delete':  ['ADMIN', 'MANAGER'],

  // ── Dashboard ────────────────────────────────────────
  'dashboard:view':   ['ADMIN', 'MANAGER', 'MEMBER'],

  // ── Profile / Analytics ─────────────────────────────
  'profile:view':     ['ADMIN', 'MANAGER', 'MEMBER'],
  'profile:view-any': ['ADMIN', 'MANAGER'],

  // ── Feedback ────────────────────────────────────────
  'feedback:create':  ['MANAGER'],
  'feedback:list':    ['ADMIN', 'MANAGER', 'MEMBER'],

  // ── Goals ───────────────────────────────────────────
  'goals:create':     ['ADMIN', 'MANAGER'],
  'goals:update':     ['ADMIN', 'MANAGER'],
  'goals:list':       ['ADMIN', 'MANAGER', 'MEMBER'],
};

module.exports = { ROLES, PERMISSIONS };
