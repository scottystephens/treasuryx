/**
 * Entity TypeScript interfaces
 * Follows industry standard for legal entity representation
 */

export interface Entity {
  entity_id: string; // Primary key (e.g., "ACME-US", "SUB-001")
  entity_name: string; // Display name
  type: EntityType; // Legal entity type
  jurisdiction: string; // State/country of incorporation
  tax_id?: string | null; // Tax ID / EIN
  status: EntityStatus;
  contact_email?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  metadata?: Record<string, any>;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export type EntityType = 
  | 'Corporation'
  | 'LLC'
  | 'Partnership'
  | 'Sole Proprietorship'
  | 'Trust'
  | 'Non-Profit'
  | 'Government'
  | 'Other';

export type EntityStatus = 'Active' | 'Inactive' | 'Dissolved';

export interface CreateEntityInput {
  entity_id: string; // User provides this (e.g., "ACME-US")
  entity_name: string;
  type: EntityType;
  jurisdiction: string;
  tax_id?: string;
  contact_email?: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  metadata?: Record<string, any>;
  tenant_id: string;
}

export interface UpdateEntityInput {
  entity_name?: string;
  type?: EntityType;
  jurisdiction?: string;
  tax_id?: string;
  status?: EntityStatus;
  contact_email?: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  metadata?: Record<string, any>;
}

// Statistics for entity overview
export interface EntityStats {
  entity: Entity;
  account_count: number;
  total_balance: number;
  currencies: string[];
}

