# Task 3/6: Authentication Tests

**Priority:** 🔴 CRITICAL  
**Status:** 🔄 IN PROGRESS  
**Tests:** 20 tests  
**File:** `tests/integration/authentication.test.ts`

---

## Overview

Test all authentication flows to ensure secure access control:
- Sign in (valid/invalid credentials)
- Sign up (new users, validation)
- Sign out (session cleanup)
- Session persistence and expiry
- Token refresh

---

## Test Breakdown

### Sign In (6 tests)
- [ ] Sign in with valid credentials
- [ ] Sign in sets user state correctly
- [ ] Sign in with invalid email
- [ ] Sign in with invalid password
- [ ] Sign in with non-existent user
- [ ] Sign in redirects to dashboard

### Sign Up (6 tests)
- [ ] Sign up with valid email/password
- [ ] Sign up creates user record
- [ ] Sign up with duplicate email fails
- [ ] Sign up with weak password fails
- [ ] Sign up sends verification email
- [ ] Email verification completes

### Sign Out (3 tests)
- [ ] Sign out clears session
- [ ] Sign out clears user state
- [ ] Sign out redirects to login

### Session Management (5 tests)
- [ ] Session persists across page reloads
- [ ] Session expires after timeout
- [ ] Expired session redirects to login
- [ ] Token refresh works automatically
- [ ] Session stored securely (httpOnly)

---

## Implementation Plan

1. Review current auth implementation (`lib/auth-context.tsx`)
2. Create test fixtures for auth flows
3. Write tests incrementally
4. Run and verify each group

---

## Success Criteria

✅ All 20 tests passing  
✅ Auth flows fully validated  
✅ Security best practices confirmed

