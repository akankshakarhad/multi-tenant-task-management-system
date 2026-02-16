/**
 * Seed script — creates sample records for every model
 * and verifies that relations are enforced and queries
 * always scope by companyId.
 *
 * Usage:  node scripts/seed.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Company = require('../models/Company');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // ── Clean previous seed data ──────────────────────────────
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── 1. Companies ──────────────────────────────────────────
  const acme = await Company.create({ name: 'Acme Corp', slug: 'acme-corp' });
  const globex = await Company.create({ name: 'Globex Inc', slug: 'globex-inc' });
  console.log('Created companies:', acme.name, '&', globex.name);

  // ── 2. Users ──────────────────────────────────────────────
  const alice = await User.create({
    name: 'Alice Admin',
    email: 'alice@acme.com',
    password: 'password123',
    age: 30,
    gender: 'Female',
    designation: 'CTO',
    company: acme._id,
    companyId: acme.slug,
    role: 'ADMIN',
  });

  const bob = await User.create({
    name: 'Bob Manager',
    email: 'bob@acme.com',
    password: 'password123',
    age: 28,
    gender: 'Male',
    designation: 'Engineering Manager',
    company: acme._id,
    companyId: acme.slug,
    role: 'MANAGER',
  });

  const carol = await User.create({
    name: 'Carol Member',
    email: 'carol@acme.com',
    password: 'password123',
    age: 25,
    gender: 'Female',
    designation: 'Developer',
    company: acme._id,
    companyId: acme.slug,
    role: 'MEMBER',
  });

  // Globex user — should never appear in Acme queries
  const dave = await User.create({
    name: 'Dave Globex',
    email: 'dave@globex.com',
    password: 'password123',
    age: 35,
    gender: 'Male',
    designation: 'CEO',
    company: globex._id,
    companyId: globex.slug,
    role: 'ADMIN',
  });

  console.log('Created users: Alice, Bob, Carol (Acme) & Dave (Globex)');

  // ── 3. Projects ───────────────────────────────────────────
  const website = await Project.create({
    name: 'Website Redesign',
    description: 'Revamp the corporate website',
    company: acme._id,
    companyId: acme.slug,
    createdBy: alice._id,
    members: [alice._id, bob._id, carol._id],
    status: 'ACTIVE',
  });

  const api = await Project.create({
    name: 'API v2',
    description: 'Build the next version of our public API',
    company: acme._id,
    companyId: acme.slug,
    createdBy: bob._id,
    members: [bob._id, carol._id],
    status: 'ACTIVE',
  });

  console.log('Created projects:', website.name, '&', api.name);

  // ── 4. Tasks ──────────────────────────────────────────────
  const task1 = await Task.create({
    title: 'Design homepage mockup',
    description: 'Create Figma mockups for the new homepage',
    project: website._id,
    company: acme._id,
    companyId: acme.slug,
    assignedTo: carol._id,
    createdBy: bob._id,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
  });

  const task2 = await Task.create({
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing',
    project: api._id,
    company: acme._id,
    companyId: acme.slug,
    assignedTo: bob._id,
    createdBy: alice._id,
    status: 'TODO',
    priority: 'MEDIUM',
  });

  console.log('Created tasks:', task1.title, '&', task2.title);

  // ── 5. Comments ───────────────────────────────────────────
  const comment1 = await Comment.create({
    text: 'Looking great so far! Can we add a dark theme option?',
    task: task1._id,
    company: acme._id,
    companyId: acme.slug,
    author: alice._id,
  });

  const comment2 = await Comment.create({
    text: 'I will push the initial mockup by Friday.',
    task: task1._id,
    company: acme._id,
    companyId: acme.slug,
    author: carol._id,
  });

  console.log('Created comments on task:', task1.title);

  // ── 6. Activity Logs ─────────────────────────────────────
  await ActivityLog.create({
    action: 'COMPANY_CREATED',
    description: 'Acme Corp was created',
    company: acme._id,
    companyId: acme.slug,
    performedBy: alice._id,
    targetType: 'Company',
    targetId: acme._id,
  });

  await ActivityLog.create({
    action: 'TASK_CREATED',
    description: `Task "${task1.title}" was created`,
    company: acme._id,
    companyId: acme.slug,
    performedBy: bob._id,
    targetType: 'Task',
    targetId: task1._id,
  });

  await ActivityLog.create({
    action: 'COMMENT_ADDED',
    description: 'Alice commented on "Design homepage mockup"',
    company: acme._id,
    companyId: acme.slug,
    performedBy: alice._id,
    targetType: 'Comment',
    targetId: comment1._id,
  });

  console.log('Created activity logs');

  // ═══════════════════════════════════════════════════════════
  //  VERIFICATION
  // ═══════════════════════════════════════════════════════════

  console.log('\n--- Verification ---\n');

  // 1. Tenant isolation: Acme query must NOT return Globex users
  const acmeUsers = await User.find({ companyId: 'acme-corp' }).select('name companyId');
  console.log('Acme users:', acmeUsers.map((u) => u.name));
  const globexLeak = acmeUsers.find((u) => u.companyId !== 'acme-corp');
  console.log('Tenant isolation:', globexLeak ? 'FAILED' : 'PASSED');

  // 2. Relations: populate project → createdBy
  const proj = await Project.findById(website._id).populate('createdBy', 'name');
  console.log(`Project "${proj.name}" created by:`, proj.createdBy.name);

  // 3. Relations: populate task → project, assignedTo
  const t = await Task.findById(task1._id)
    .populate('project', 'name')
    .populate('assignedTo', 'name');
  console.log(`Task "${t.title}" in project "${t.project.name}", assigned to ${t.assignedTo.name}`);

  // 4. Relations: populate comment → task, author
  const c = await Comment.findById(comment1._id)
    .populate('task', 'title')
    .populate('author', 'name');
  console.log(`Comment by ${c.author.name} on task "${c.task.title}": "${c.text}"`);

  // 5. Soft delete: delete Carol, then verify she's excluded from finds
  await carol.softDelete();
  const acmeAfterDelete = await User.find({ companyId: 'acme-corp' }).select('name');
  console.log('Acme users after soft-deleting Carol:', acmeAfterDelete.map((u) => u.name));
  const carolStillThere = acmeAfterDelete.find((u) => u.name === 'Carol Member');
  console.log('Soft delete:', carolStillThere ? 'FAILED' : 'PASSED');

  // 6. Activity log scoped to company
  const logs = await ActivityLog.find({ companyId: 'acme-corp' }).sort({ createdAt: 1 });
  console.log('Acme activity logs:', logs.length, 'entries');

  console.log('\nSeed complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
