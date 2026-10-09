import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// 1. profiles (linked to authenticated user via Firebase Auth UID)
export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('profiles_uid_idx').on(table.uid)]
);

// 2. portfolios (each user receives initial virtual balance of ₹10,00,000)
export const portfolios = pgTable(
  'portfolios',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    initialCash: numeric('initial_cash', { precision: 15, scale: 2 })
      .notNull()
      .default('1000000.00'),
    availableCash: numeric('available_cash', { precision: 15, scale: 2 })
      .notNull()
      .default('1000000.00'),
    realizedPnl: numeric('realized_pnl', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('portfolios_user_id_idx').on(table.userId)]
);

// 3. stocks (symbol, company_name, exchange, metadata)
export const stocks = pgTable(
  'stocks',
  {
    id: serial('id').primaryKey(),
    symbol: text('symbol').notNull().unique(),
    companyName: text('company_name').notNull(),
    exchange: text('exchange').notNull().default('NSE'),
    sector: text('sector').notNull().default('Technology'),
    lotSize: integer('lot_size').notNull().default(1),
    metadata: text('metadata'), // JSON string with marketCap, peRatio, week52High, week52Low, description
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('stocks_symbol_idx').on(table.symbol)]
);

// 4. stock_prices (stock_id, price, timestamp, source)
export const stockPrices = pgTable(
  'stock_prices',
  {
    id: serial('id').primaryKey(),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 15, scale: 2 }).notNull(),
    open: numeric('open', { precision: 15, scale: 2 }),
    high: numeric('high', { precision: 15, scale: 2 }),
    low: numeric('low', { precision: 15, scale: 2 }),
    volume: integer('volume'),
    source: text('source').notNull().default('SIMULATED_CACHE'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [index('stock_prices_stock_id_idx').on(table.stockId)]
);

// 5. holdings (portfolio_id, stock_id, quantity, average_buy_price, updated_at)
export const holdings = pgTable(
  'holdings',
  {
    id: serial('id').primaryKey(),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(0),
    averageBuyPrice: numeric('average_buy_price', { precision: 15, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('holdings_portfolio_stock_idx').on(table.portfolioId, table.stockId),
  ]
);

// 6. trades (id, user_id, portfolio_id, stock_id, side, quantity, execution_price, fees, total_amount, realized_pnl, idempotency_key, created_at)
export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    portfolioId: integer('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    side: text('side').notNull(), // 'BUY' | 'SELL'
    quantity: integer('quantity').notNull(),
    executionPrice: numeric('execution_price', { precision: 15, scale: 2 }).notNull(),
    fees: numeric('fees', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
    realizedPnl: numeric('realized_pnl', { precision: 15, scale: 2 }),
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('trades_user_id_idx').on(table.userId),
    index('trades_portfolio_id_idx').on(table.portfolioId),
  ]
);

// 7. predictions (id, user_id, stock_id, predicted_direction, entry_price, target_price, reasoning, prediction_horizon, status, resolved_price, resolved_at, created_at)
export const predictions = pgTable(
  'predictions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    predictedDirection: text('predicted_direction').notNull(), // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    entryPrice: numeric('entry_price', { precision: 15, scale: 2 }).notNull(),
    targetPrice: numeric('target_price', { precision: 15, scale: 2 }),
    reasoning: text('reasoning').notNull(),
    predictionHorizon: text('prediction_horizon').notNull(), // '1D' | '3D' | '1W' | '2W'
    status: text('status').notNull().default('PENDING'), // 'PENDING' | 'ACCURATE' | 'INACCURATE'
    resolvedPrice: numeric('resolved_price', { precision: 15, scale: 2 }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('predictions_user_id_idx').on(table.userId)]
);

// 8. learning_progress (user_id, lesson_id, completion_status, quiz_score, completed_at)
export const learningProgress = pgTable(
  'learning_progress',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    lessonId: text('lesson_id').notNull(),
    completionStatus: text('completion_status').notNull().default('COMPLETED'),
    quizScore: integer('quiz_score').default(100),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('learning_progress_user_lesson_idx').on(table.userId, table.lessonId),
  ]
);

// 9. watchlists (user_id, stock_id, created_at)
export const watchlists = pgTable(
  'watchlists',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('watchlists_user_stock_idx').on(table.userId, table.stockId),
  ]
);

// Relations
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [profiles.uid],
    references: [portfolios.userId],
  }),
  trades: many(trades),
  predictions: many(predictions),
  learningProgress: many(learningProgress),
  watchlists: many(watchlists),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [portfolios.userId],
    references: [profiles.uid],
  }),
  holdings: many(holdings),
  trades: many(trades),
}));
