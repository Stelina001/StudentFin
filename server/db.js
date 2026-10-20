/*
 * Code-first data model (Sequelize ORM + SQLite).
 * The tables are generated from these model definitions when the server starts (sequelize.sync()),
 * so the database schema lives in code. Switch to PostgreSQL by changing DATABASE_URL only.
 */
import { Sequelize, DataTypes } from 'sequelize';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = process.env.DB_PATH || path.join(root, 'data', 'studentfin.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, { logging: false })
  : new Sequelize({ dialect: 'sqlite', storage: dbFile, logging: false });

export const DEFAULT_LIMITS = { Housing: 350, Food: 180, Transport: 80, Education: 100, Entertainment: 80, Utilities: 60, Health: 40, Transfers: 30, Other: 100 };

const money = { type: DataTypes.DOUBLE, allowNull: false, validate: { min: 0 } };

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  country: { type: DataTypes.STRING(60), defaultValue: 'Albania' },
  studyCity: { type: DataTypes.STRING(40), defaultValue: 'milan' },
  currency: { type: DataTypes.STRING(3), defaultValue: 'EUR' },
  monthlyIncome: { type: DataTypes.DOUBLE, defaultValue: 1200 },
  savingsGoal: { type: DataTypes.DOUBLE, defaultValue: 250 },
  categoryLimits: { type: DataTypes.JSON, defaultValue: DEFAULT_LIMITS },
  agentEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  maxActionAmount: { type: DataTypes.DOUBLE, defaultValue: 300 },
  isDemo: { type: DataTypes.BOOLEAN, defaultValue: false },
  seededMonth: { type: DataTypes.STRING(7), allowNull: true }
}, { tableName: 'users' });

export const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(80), allowNull: false },
  amount: money, // always EUR
  type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
  category: { type: DataTypes.STRING(40), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  note: { type: DataTypes.STRING(160), defaultValue: '' },
  originalAmount: { type: DataTypes.DOUBLE, allowNull: true },
  originalCurrency: { type: DataTypes.STRING(3), allowNull: true },
  source: { type: DataTypes.ENUM('manual', 'agent', 'seed', 'import'), defaultValue: 'manual' }
}, { tableName: 'transactions', indexes: [{ fields: ['userId', 'date'] }] });

export const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(80), allowNull: false },
  amount: money,
  due: { type: DataTypes.DATEONLY, allowNull: false },
  category: { type: DataTypes.STRING(40), defaultValue: 'Other' },
  paid: { type: DataTypes.BOOLEAN, defaultValue: false },
  source: { type: DataTypes.ENUM('manual', 'agent', 'seed', 'import'), defaultValue: 'manual' }
}, { tableName: 'payments', indexes: [{ fields: ['userId', 'due'] }] });

// A change the AI agent wants to make. Stored server-side so the client cannot alter it before approval.
export const Proposal = sequelize.define('Proposal', {
  id: { type: DataTypes.STRING(40), primaryKey: true },
  type: { type: DataTypes.STRING(40), allowNull: false },
  params: { type: DataTypes.JSON, allowNull: false },
  reason: { type: DataTypes.STRING(240) },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired', 'blocked'), defaultValue: 'pending' },
  decidedAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'proposals', indexes: [{ fields: ['userId', 'status'] }] });

// Append-only audit trail of agent tool calls, proposals, decisions and user actions.
export const ActivityLog = sequelize.define('ActivityLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  kind: { type: DataTypes.ENUM('tool', 'proposal', 'decision', 'manual', 'auth'), allowNull: false },
  tool: { type: DataTypes.STRING(60) },
  actionType: { type: DataTypes.STRING(60) },
  input: { type: DataTypes.JSON },
  params: { type: DataTypes.JSON },
  status: { type: DataTypes.STRING(40) },
  reason: { type: DataTypes.STRING(240) },
  mode: { type: DataTypes.STRING(20) }
}, { tableName: 'activity_logs', updatedAt: false, indexes: [{ fields: ['userId', 'createdAt'] }] });

// Relationships: every record belongs to exactly one user (data isolation).
for (const M of [Transaction, Payment, Proposal, ActivityLog]) {
  User.hasMany(M, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
  M.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false } });
}

export async function initDb() {
  await sequelize.authenticate();
  await sequelize.sync(); // creates any missing tables from the models above
  return dbFile;
}
