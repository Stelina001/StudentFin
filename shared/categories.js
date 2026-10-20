export const EXPENSE_CATEGORIES = ['Food', 'Housing', 'Transport', 'Education', 'Entertainment', 'Utilities', 'Health', 'Transfers', 'Other'];
export const INCOME_CATEGORIES = ['Income', 'Allowance', 'Salary', 'Freelance', 'Scholarship', 'Other'];
export const PAYMENT_CATEGORIES = ['Housing', 'Utilities', 'Education', 'Subscription', 'Transport', 'Other'];
export const BUDGET_CATEGORIES = ['Housing', 'Food', 'Transport', 'Education', 'Entertainment', 'Utilities', 'Health', 'Transfers', 'Other'];

// Map free text to an expense category (used by the offline demo agent).
export function guessCategory(text = '') {
  const t = text.toLowerCase();
  const rules = [
    ['Food', /(food|grocer|lunch|dinner|breakfast|coffee|restaurant|pizza|supermarket|snack|meal)/],
    ['Housing', /(rent|room|apartment|flat|dorm|housing|qira)/],
    ['Transport', /(bus|train|metro|taxi|uber|fuel|petrol|ticket|flight|transport)/],
    ['Education', /(book|course|tuition|fee|university|exam|printing|laptop|school)/],
    ['Entertainment', /(cinema|movie|netflix|spotify|game|concert|party|bar|club)/],
    ['Utilities', /(internet|phone|electric|water|gas bill|utility|wifi)/],
    ['Health', /(pharmacy|doctor|medicine|gym|dentist)/],
    ['Transfers', /(transfer|remittance|fee for sending)/]
  ];
  return (rules.find(([, re]) => re.test(t)) || ['Other'])[0];
}
