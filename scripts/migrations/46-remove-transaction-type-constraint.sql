-- Migration 46: Remove overly restrictive transaction type constraint
-- 
-- Problem: The CHECK constraint on transactions.type column is blocking
-- valid transactions from Plaid and other providers because it enforces
-- capitalization ('Credit' vs 'credit').
--
-- Since we control this field and the UI already handles both cases,
-- we're removing the constraint to allow flexibility.
--
-- The application code will standardize on lowercase ('credit', 'debit')
-- but existing capitalized data will continue to work.

-- Drop the constraint
ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Optional: Add a less restrictive constraint that just checks for valid values
-- (case-insensitive)
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check 
  CHECK (LOWER(type) IN ('credit', 'debit'));

-- Add comment
COMMENT ON COLUMN public.transactions.type IS 'Transaction type: credit (money in) or debit (money out). Case-insensitive.';

