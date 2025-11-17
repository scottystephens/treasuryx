
## Database Design Principles

### Text Field Length Policy

**All text fields use unlimited TEXT type for maximum flexibility.**

- ✅ **DO**: Use `TEXT` for all string columns
- ❌ **DON'T**: Use `VARCHAR(n)` or `CHAR(n)` with length restrictions
- **Why**: Prevents field length errors and provides flexibility as requirements change

```sql
-- Good
CREATE TABLE example (
  name TEXT,
  description TEXT,
  email TEXT
);

-- Avoid
CREATE TABLE example (
  name VARCHAR(255),
  description VARCHAR(1000),
  email VARCHAR(100)
);
```

**Migration 14** removed all existing length restrictions to enforce this policy.

### Exceptions

The only acceptable length restrictions are:
- Database-level constraints for validation (e.g., CHECK constraints)
- Composite indexes where PostgreSQL requires length limits

In these cases, document the reason in the migration.

