/**
 * Transaction Sync Service
 * Intelligent transaction syncing with cost optimization
 */

import { supabase } from '../supabase';

export interface SyncDateRange {
  startDate: Date;
  endDate: Date;
  reason: 'initial_backfill' | 'incremental' | 'moderate_gap' | 'long_gap_backfill' | 'forced';
  skip?: boolean;
  daysSinceLastSync?: number;
}

export interface BackfillConfig {
  checking: number;
  savings: number;
  credit_card: number;
  loan: number;
  investment: number;
  default: number;
}

// Configurable backfill periods by account type (in days)
const BACKFILL_PERIODS: BackfillConfig = {
  checking: 90,
  savings: 180,
  credit_card: 365,
  loan: 365,
  investment: 180,
  default: 90,
};

// Initial connections should fetch the deepest range possible (2 years)
const INITIAL_BACKFILL_DAYS = 730;

// Sync throttling settings
const MIN_SYNC_INTERVAL_HOURS = 1; // Don't sync more than once per hour (unless forced)
const INCREMENTAL_OVERLAP_DAYS = 3; // 3-day overlap for incremental syncs
const MODERATE_GAP_OVERLAP_DAYS = 10; // Larger overlap for weekly/monthly syncs

/**
 * Determine the optimal date range for syncing transactions
 * Uses intelligent logic to minimize API calls while ensuring data completeness
 */
export async function determineSyncDateRange(
  accountId: string,
  connectionId: string,
  accountType: string = 'checking',
  force: boolean = false
): Promise<SyncDateRange> {
  const now = new Date();

  // Get the last sync time for this account
  const { data: account } = await supabase
    .from('accounts')
    .select('last_synced_at')
    .eq('account_id', accountId)
    .eq('connection_id', connectionId)
    .single();

  const lastSyncAt = account?.last_synced_at ? new Date(account.last_synced_at) : null;
  const lastTransactionDate = await getLastTransactionDate(accountId, connectionId);
  const mostRecentSyncPoint = getMostRecentDate(lastSyncAt, lastTransactionDate);

  // First-time sync - do a full backfill
  if (!mostRecentSyncPoint) {
    const backfillDays = getInitialBackfillPeriod(accountType);
    return {
      startDate: new Date(now.getTime() - backfillDays * 24 * 60 * 60 * 1000),
      endDate: now,
      reason: 'initial_backfill',
    };
  }

  // Calculate hours since last sync
  const hoursSinceSync = (now.getTime() - mostRecentSyncPoint.getTime()) / (60 * 60 * 1000);
  const daysSinceSync = hoursSinceSync / 24;

  // Very recent sync - skip unless forced
  if (hoursSinceSync < MIN_SYNC_INTERVAL_HOURS && !force) {
    return {
      startDate: mostRecentSyncPoint,
      endDate: now,
      reason: 'incremental',
      skip: true,
      daysSinceLastSync: daysSinceSync,
    };
  }

  // Forced sync - always sync, but use incremental window
  if (force) {
    return {
      startDate: new Date(mostRecentSyncPoint.getTime() - INCREMENTAL_OVERLAP_DAYS * 24 * 60 * 60 * 1000),
      endDate: now,
      reason: 'forced',
      daysSinceLastSync: daysSinceSync,
    };
  }

  // Recent sync (< 7 days) - incremental with 1-day overlap
  if (daysSinceSync <= 7) {
    return {
      startDate: new Date(mostRecentSyncPoint.getTime() - INCREMENTAL_OVERLAP_DAYS * 24 * 60 * 60 * 1000),
      endDate: now,
      reason: 'incremental',
      daysSinceLastSync: daysSinceSync,
    };
  }

  // Moderate gap (7-30 days) - larger window with 1-week overlap
  if (daysSinceSync <= 30) {
    return {
      startDate: new Date(mostRecentSyncPoint.getTime() - MODERATE_GAP_OVERLAP_DAYS * 24 * 60 * 60 * 1000),
      endDate: now,
      reason: 'moderate_gap',
      daysSinceLastSync: daysSinceSync,
    };
  }

  // Large gap (> 30 days) - full backfill
  const backfillDays = getBackfillPeriod(accountType);
  return {
    startDate: new Date(now.getTime() - backfillDays * 24 * 60 * 60 * 1000),
    endDate: now,
    reason: 'long_gap_backfill',
    daysSinceLastSync: daysSinceSync,
  };
}

/**
 * Get the backfill period for a given account type
 */
export function getBackfillPeriod(accountType: string): number {
  const normalizedType = accountType.toLowerCase().replace(/[_\s-]/g, '');

  if (normalizedType.includes('checking')) return BACKFILL_PERIODS.checking;
  if (normalizedType.includes('saving')) return BACKFILL_PERIODS.savings;
  if (normalizedType.includes('credit')) return BACKFILL_PERIODS.credit_card;
  if (normalizedType.includes('loan') || normalizedType.includes('mortgage')) return BACKFILL_PERIODS.loan;
  if (normalizedType.includes('investment') || normalizedType.includes('brokerage'))
    return BACKFILL_PERIODS.investment;

  return BACKFILL_PERIODS.default;
}

function getInitialBackfillPeriod(accountType: string): number {
  return Math.max(getBackfillPeriod(accountType), INITIAL_BACKFILL_DAYS);
}

function getMostRecentDate(
  lastSyncAt: Date | null,
  lastTransactionDate: Date | null
): Date | null {
  if (lastSyncAt && lastTransactionDate) {
    return lastSyncAt > lastTransactionDate ? lastSyncAt : lastTransactionDate;
  }

  return lastSyncAt || lastTransactionDate || null;
}

/**
 * Get the last transaction date for an account
 * Useful for determining incremental sync windows
 */
export async function getLastTransactionDate(
  accountId: string,
  connectionId: string
): Promise<Date | null> {
  const { data: transaction } = await supabase
    .from('transactions')
    .select('date')
    .eq('account_id', accountId)
    .eq('connection_id', connectionId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return transaction?.date ? new Date(transaction.date) : null;
}

/**
 * Check if an account needs syncing
 */
export async function shouldSyncAccount(
  accountId: string,
  connectionId: string,
  minHoursSinceLastSync: number = MIN_SYNC_INTERVAL_HOURS
): Promise<boolean> {
  const { data: account } = await supabase
    .from('accounts')
    .select('last_synced_at, sync_enabled')
    .eq('account_id', accountId)
    .eq('connection_id', connectionId)
    .single();

  if (!account) return true; // Account doesn't exist, should sync

  // Check if sync is enabled
  if (account.sync_enabled === false) return false;

  // Check if never synced
  if (!account.last_synced_at) return true;

  // Check if enough time has passed
  const lastSyncAt = new Date(account.last_synced_at);
  const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (60 * 60 * 1000);

  return hoursSinceSync >= minHoursSinceLastSync;
}

/**
 * Calculate sync metrics for monitoring
 */
export interface SyncMetrics {
  dateRange: SyncDateRange;
  estimatedDays: number;
  estimatedApiCalls: number;
  costOptimization: 'high' | 'medium' | 'low'; // How much we're saving vs naive approach
}

export function calculateSyncMetrics(dateRange: SyncDateRange): SyncMetrics {
  if (dateRange.skip) {
    return {
      dateRange,
      estimatedDays: 0,
      estimatedApiCalls: 0,
      costOptimization: 'high',
    };
  }

  const estimatedDays = Math.ceil(
    (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Estimate API calls (assumes 1 call per 500 transactions, ~50 transactions/day average)
  const estimatedTransactions = estimatedDays * 50;
  const estimatedApiCalls = Math.ceil(estimatedTransactions / 500);

  // Compare to naive approach (always 90 days)
  const naiveApiCalls = Math.ceil((90 * 50) / 500);
  const savings = (naiveApiCalls - estimatedApiCalls) / naiveApiCalls;

  let costOptimization: 'high' | 'medium' | 'low' = 'low';
  if (savings > 0.7) costOptimization = 'high';
  else if (savings > 0.4) costOptimization = 'medium';

  return {
    dateRange,
    estimatedDays,
    estimatedApiCalls,
    costOptimization,
  };
}

/**
 * Format sync metrics for logging
 */
export function formatSyncMetrics(metrics: SyncMetrics): string {
  if (metrics.dateRange.skip) {
    return `⏭️  Skipping sync (last synced ${metrics.dateRange.daysSinceLastSync?.toFixed(1)} days ago, within throttle limit)`;
  }

  const days = metrics.estimatedDays;
  const calls = metrics.estimatedApiCalls;
  const reason = metrics.dateRange.reason.replace(/_/g, ' ');
  const optimization =
    metrics.costOptimization === 'high' ? '💰 High savings' : metrics.costOptimization === 'medium' ? '💵 Medium savings' : '💸 Standard cost';

  return `📊 Sync: ${days} days, ~${calls} API call(s), reason: ${reason} ${optimization}`;
}

