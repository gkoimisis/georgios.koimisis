/** Shared key lists used by both the schema (build time) and the engine (runtime). Keep zod out of here. */
export const QUALITIES = ['best', 'good', 'risky', 'costly'] as const;
/** Recurring monthly budget lines and income the engine simulates. */
export const RECURRING_KEYS = ['grossAnnualIncome', 'rent', 'otherNeeds', 'wants', 'subscriptions', 'autoSave'] as const;
/** Balances an effect can move directly. */
export const BALANCE_KEYS = ['checking', 'savings', 'card', 'studentLoan', 'retirement', 'brokerage'] as const;
/** 0-100 sub-meters. */
export const METER_KEYS = ['stress', 'health', 'freeTime', 'friends', 'family', 'partner', 'goals'] as const;
