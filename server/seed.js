import bcrypt from 'bcryptjs';
import { sequelize, User, Transaction, Payment, Proposal, ActivityLog, DEFAULT_LIMITS } from './db.js';

export const DEMO_EMAIL = 'demo@studentfin.app';
export const DEMO_PASSWORD = 'demo1234';

const pad = n => String(n).padStart(2, '0');
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The sample workspace. Dates are placed in the current month so charts and alerts stay "live".
export function sampleData(today = localToday()) {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const d = n => `${month}-${pad(n)}`;
  return {
    transactions: [
      { title: 'Monthly allowance from family', category: 'Allowance', date: d(1), amount: 650, type: 'income', note: 'Sent from Tirana', originalAmount: 63375, originalCurrency: 'ALL' },
      { title: 'Room rent', category: 'Housing', date: d(2), amount: 220, type: 'expense' },
      { title: 'Groceries', category: 'Food', date: d(4), amount: 46.8, type: 'expense' },
      { title: 'Monthly bus pass', category: 'Transport', date: d(5), amount: 18, type: 'expense' },
      { title: 'Freelance website', category: 'Freelance', date: d(7), amount: 120, type: 'income', note: 'Landing page project' },
      { title: 'Coffee & lunch', category: 'Food', date: d(9), amount: 12.5, type: 'expense' },
      { title: 'Online course', category: 'Education', date: d(11), amount: 15, type: 'expense' },
      { title: 'Transfer fee (bank wire)', category: 'Transfers', date: d(1), amount: 16.3, type: 'expense', note: 'Fee on family transfer' },
      { title: 'Cinema', category: 'Entertainment', date: d(13), amount: 11, type: 'expense' }
    ].map(t => ({ note: '', originalAmount: t.amount, originalCurrency: 'EUR', ...t, source: 'seed' })),
    payments: [
      { title: 'Rent', amount: 220, due: d(25), category: 'Housing', paid: false },
      { title: 'Internet', amount: 15, due: d(Math.min(28, day + 2)), category: 'Utilities', paid: false },
      { title: 'Phone plan', amount: 8, due: d(12), category: 'Utilities', paid: true }
    ].map(p => ({ ...p, source: 'seed' })),
    month
  };
}

// Replace a user's records with the sample workspace (used for new users, demo refresh and "Reset").
export async function seedUser(user) {
  const data = sampleData();
  await sequelize.transaction(async (t) => {
    await Transaction.destroy({ where: { userId: user.id }, transaction: t });
    await Payment.destroy({ where: { userId: user.id }, transaction: t });
    await Proposal.destroy({ where: { userId: user.id }, transaction: t });
    await Transaction.bulkCreate(data.transactions.map(x => ({ ...x, userId: user.id })), { transaction: t });
    await Payment.bulkCreate(data.payments.map(x => ({ ...x, userId: user.id })), { transaction: t });
    await user.update({ monthlyIncome: 1200, savingsGoal: 250, categoryLimits: DEFAULT_LIMITS, agentEnabled: true, maxActionAmount: 300, seededMonth: data.month }, { transaction: t });
  });
}

// Ensure the shared demo account exists and its sample data is for the current month.
export async function ensureDemoUser() {
  let demo = await User.findOne({ where: { email: DEMO_EMAIL } });
  if (!demo) {
    demo = await User.create({ name: 'Student', email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10), isDemo: true });
    await seedUser(demo);
  } else if (demo.seededMonth !== localToday().slice(0, 7)) {
    await seedUser(demo);
    await ActivityLog.destroy({ where: { userId: demo.id } });
  }
  return demo;
}
