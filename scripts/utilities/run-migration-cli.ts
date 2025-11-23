#!/usr/bin/env tsx

/**
 * Run SQL migrations using Supabase CLI (npx supabase db push)
 * 
 * This script copies migrations from scripts/migrations/ to supabase/migrations/
 * with proper timestamp naming, then uses Supabase CLI to apply them.
 * 
 * Usage:
 *   npx tsx scripts/utilities/run-migration-cli.ts <migration-file>
 * 
 * Example:
 *   npx tsx scripts/utilities/run-migration-cli.ts scripts/migrations/38-create-direct-bank-docs.sql
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');
const SCRIPTS_MIGRATIONS_DIR = resolve(process.cwd(), 'scripts/migrations');

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function sanitizeFilename(filename: string): string {
  // Remove .sql extension and any path, keep only the base name
  const base = basename(filename, '.sql');
  // Replace spaces and special chars with underscores
  return base.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

async function runMigration(migrationFile: string) {
  const fullPath = resolve(process.cwd(), migrationFile);
  
  if (!existsSync(fullPath)) {
    console.error(`❌ Migration file not found: ${fullPath}`);
    process.exit(1);
  }

  // Ensure supabase/migrations directory exists
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Supabase migrations directory not found: ${MIGRATIONS_DIR}`);
    console.error(`   Run: mkdir -p ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  // Read the migration file
  const sqlContent = readFileSync(fullPath, 'utf-8');
  const timestamp = generateTimestamp();
  const sanitized = sanitizeFilename(migrationFile);
  const newFilename = `${timestamp}_${sanitized}.sql`;
  const targetPath = resolve(MIGRATIONS_DIR, newFilename);

  console.log(`📊 Running migration via Supabase CLI:`);
  console.log(`   Source: ${migrationFile}`);
  console.log(`   Target: supabase/migrations/${newFilename}`);
  console.log('');

  try {
    // Copy migration to supabase/migrations with timestamp
    writeFileSync(targetPath, sqlContent, 'utf-8');
    console.log(`✓ Copied migration to ${targetPath}`);

    // Run supabase db push
    console.log('');
    console.log('🚀 Pushing migration to remote database...');
    console.log('');
    
    execSync(
      'npx supabase db push --linked --yes',
      {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: { ...process.env }
      }
    );

    console.log('');
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log(`📝 Migration file kept at: ${targetPath}`);
    console.log('   (You can delete it manually if needed)');

  } catch (error: any) {
    console.error('');
    console.error('❌ Migration failed!');
    
    // Clean up the copied file on error
    if (existsSync(targetPath)) {
      console.log(`🧹 Cleaning up ${targetPath}...`);
      unlinkSync(targetPath);
    }
    
    if (error.stdout) {
      console.error('STDOUT:', error.stdout.toString());
    }
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/utilities/run-migration-cli.ts <migration-file>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/utilities/run-migration-cli.ts scripts/migrations/38-create-direct-bank-docs.sql');
  process.exit(1);
}

runMigration(migrationFile).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

