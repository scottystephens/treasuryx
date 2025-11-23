/**
 * Test: CSV Parser
 * Priority: HIGH - Data ingestion is core feature
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, detectColumnMapping, validateCSVHeaders } from '@/lib/csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV data', async () => {
      const csvContent = `Date,Description,Amount,Currency
2024-01-01,Test Transaction,100.50,USD
2024-01-02,Another Transaction,-50.25,EUR`;

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({
        Date: '2024-01-01',
        Description: 'Test Transaction',
        Amount: '100.50',
        Currency: 'USD',
      });
    });

    it('should handle CSV with quoted fields', async () => {
      const csvContent = `Date,Description,Amount
2024-01-01,"Transaction with, comma",100.50
2024-01-02,"Transaction with ""quotes""",200.00`;

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(true);
      expect(result.rows[0].Description).toBe('Transaction with, comma');
      expect(result.rows[1].Description).toBe('Transaction with "quotes"');
    });

    it('should handle empty lines', async () => {
      const csvContent = `Date,Description,Amount

2024-01-01,Transaction,100.50

2024-01-02,Another,200.00`;

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
    });

    it('should handle different line endings (CRLF)', async () => {
      const csvContent = "Date,Description,Amount\r\n2024-01-01,Test,100.50\r\n";

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it('should reject empty CSV', async () => {
      const csvContent = '';

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject CSV with only headers', async () => {
      const csvContent = 'Date,Description,Amount';

      const result = await parseCSV(csvContent);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No data rows');
    });
  });

  describe('detectColumnMapping', () => {
    it('should detect standard column names', () => {
      const headers = ['Date', 'Description', 'Amount', 'Currency'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.date).toBe('Date');
      expect(mapping.description).toBe('Description');
      expect(mapping.amount).toBe('Amount');
      expect(mapping.currency).toBe('Currency');
    });

    it('should detect common variations', () => {
      const headers = ['Transaction Date', 'Desc', 'Amt', 'Curr'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.date).toBe('Transaction Date');
      expect(mapping.description).toBe('Desc');
      expect(mapping.amount).toBe('Amt');
      expect(mapping.currency).toBe('Curr');
    });

    it('should handle case-insensitive matching', () => {
      const headers = ['date', 'DESCRIPTION', 'AmOuNt', 'currency'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.date).toBeDefined();
      expect(mapping.description).toBeDefined();
      expect(mapping.amount).toBeDefined();
      expect(mapping.currency).toBeDefined();
    });

    it('should detect Balance column', () => {
      const headers = ['Date', 'Description', 'Amount', 'Balance'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.balance).toBe('Balance');
    });

    it('should detect Reference/Transaction ID', () => {
      const headers = ['Date', 'Reference', 'Description', 'Amount'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.reference).toBe('Reference');
    });
  });

  describe('validateCSVHeaders', () => {
    it('should validate CSV with all required columns', () => {
      const headers = ['Date', 'Description', 'Amount'];
      
      expect(() => validateCSVHeaders(headers)).not.toThrow();
    });

    it('should reject CSV missing date column', () => {
      const headers = ['Description', 'Amount'];
      
      expect(() => validateCSVHeaders(headers)).toThrow('date');
    });

    it('should reject CSV missing amount column', () => {
      const headers = ['Date', 'Description'];
      
      expect(() => validateCSVHeaders(headers)).toThrow('amount');
    });

    it('should allow optional columns to be missing', () => {
      const headers = ['Date', 'Description', 'Amount'];
      // Currency is optional
      
      expect(() => validateCSVHeaders(headers)).not.toThrow();
    });
  });
});

