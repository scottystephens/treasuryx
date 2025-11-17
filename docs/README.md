# Stratifi Documentation

Welcome to the Stratifi documentation. This README provides an overview of available documentation and where to find what you need.

## 📚 Table of Contents

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Integrations](#integrations)
- [Guides](#guides)
- [Migrations](#migrations)
- [Archive](#archive)

## Getting Started

**New to Stratifi?** Start here:

1. [Main README](../README.md) - Project overview and quick start
2. [Database Setup](guides/DATABASE_SETUP.md) - Initial database configuration
3. [Deployment](guides/deployment.md) - Deploy to production

## Architecture

High-level system design and principles:

- [Multi-Tenant System](architecture/MULTI_TENANT_SYSTEM.md) - Tenant isolation and RLS
- [Data Ingestion Architecture](architecture/DATA_INGESTION_ARCHITECTURE.md) - How data flows
- [Bank Data Standards](architecture/BANK_DATA_STANDARDS.md) - Industry-standard field mappings
- [Database Design Principles](architecture/DATABASE_DESIGN_PRINCIPLES.md) - TEXT fields, no length restrictions

## Integrations

### Banking Providers

- **[Tink](integrations/tink/README.md)** - Open Banking platform (3,400+ European banks)
  - Status: ✅ Production Ready
  - API: v2 with intelligent sync
  - Coverage: Europe-wide

- **[Bunq](integrations/bunq/README.md)** - Direct Bunq integration
  - Status: ✅ Production Ready
  - API: OAuth 2.0
  - Coverage: Netherlands, EU

### Adding More Providers

- [Adding New Banking Providers](guides/ADDING_NEW_BANKING_PROVIDERS.md) - Step-by-step guide
- [Banking Aggregation Providers](guides/BANKING_AGGREGATION_PROVIDERS.md) - Provider comparison

## Guides

### Core Features

- **[Account Management](guides/account-management.md)** - Create, sync, deduplicate accounts
- **[Transaction Sync](guides/transaction-sync.md)** - Intelligent sync strategy (80-90% API reduction)
- **[CSV Ingestion](guides/CSV_INGESTION_COMPLETE.md)** - Import bank statements via CSV
- **[Data Types](guides/DATA_TYPE_UI_GUIDE.md)** - transactions vs statements
- **[Transactions vs Statements](guides/TRANSACTIONS_VS_STATEMENTS.md)** - Understanding the difference

### Infrastructure

- **[Deployment](guides/deployment.md)** - Production deployment guide
- **[Production Deployment](guides/PRODUCTION_DEPLOYMENT.md)** - Detailed production checklist
- **[Supabase CLI Setup](guides/SUPABASE_CLI_SETUP.md)** - CLI configuration
- **[Database Setup](guides/DATABASE_SETUP.md)** - Initial database configuration

### Banking

- **[Multi-Bank Standardization](guides/MULTI_BANK_STANDARDIZATION.md)** - Standard field mappings
- **[Exchange Rates](guides/EXCHANGE_RATES.md)** - Multi-currency support

## Migrations

Database schema changes over time:

- [Migrations 13-14 Summary](migrations/MIGRATIONS-13-14-SUMMARY.md) - Field length fixes
- Individual migrations: `../scripts/migrations/`

### Running Migrations

**Always use Supabase SQL Editor** for schema changes:

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy migration SQL from `../scripts/migrations/`
3. Paste and execute
4. Verify success

## Archive

Historical documentation and old implementation summaries:

- `archive/old-implementations/` - Previous implementation docs
- `archive/` - Deprecated guides and references

## Quick Links

### For Developers

- [.cursorrules](../.cursorrules) - Project coding standards
- [scripts/README.md](../scripts/README.md) - Utility scripts
- [data/backups/](../data/backups/) - Sample data and backups

### For Users

- **Production App**: https://stratifi-pi.vercel.app
- **Supabase Dashboard**: https://supabase.com/dashboard/project/vnuithaqtpgbwmdvtxik

### For Administrators

- [GitHub Repository](https://github.com/scottystephens/stratifi)
- [Vercel Dashboard](https://vercel.com/scottystephens-projects/stratifi)
- [STRATIFI_BRAND.md](STRATIFI_BRAND.md) - Brand guidelines

## Documentation Standards

### File Organization

```
docs/
├── README.md (this file)
├── architecture/         # System design
├── integrations/         # Provider-specific docs
│   ├── bunq/
│   └── tink/
├── guides/               # How-to guides
├── migrations/           # Database change summaries
└── archive/              # Deprecated docs
```

### Naming Conventions

- Use `kebab-case` for multi-word filenames
- Use `UPPERCASE` for major architecture docs
- Use `README.md` for integration/module overviews

### Writing Guidelines

- Start with "Overview" section
- Include "Status" (✅ Production Ready, 🚧 In Progress, etc.)
- Add "Last Updated" date
- Use code examples
- Link to related docs

## Contributing

When adding documentation:

1. Place in appropriate directory
2. Follow naming conventions
3. Update this README if adding new section
4. Link from related docs
5. Include examples and code snippets

## Getting Help

- Check relevant guide in `guides/`
- Review integration docs in `integrations/`
- Check archive for historical context
- Review `.cursorrules` for coding standards

## Updates

This documentation is actively maintained. Last reorganization: **November 16, 2025**

Major changes:
- Consolidated provider docs into `integrations/`
- Moved implementation summaries to `archive/`
- Created consolidated guides
- Simplified file structure

---

**Stratifi** - Strategic Financial Intelligence Platform  
Production: https://stratifi-pi.vercel.app
