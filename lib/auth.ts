// Supabase Auth utilities for server and client
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Types
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Session {
  access_token: string
  refresh_token: string
  user: User
}

// Server-side auth client (for Server Components and API routes)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
}

// Get session from cookies (Server Components)
export async function getSession() {
  const supabase = createServerClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error in getSession:', error)
    return null
  }
}

// Get current user (Server Components)
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user || null
}

// Check if user is authenticated (Server Components)
export async function isAuthenticated() {
  const session = await getSession()
  return !!session
}

// Sign out (can be called from Server Actions)
export async function signOut() {
  const supabase = createServerClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    throw error
  }
}

// Get user's tenants
export async function getUserTenants(userId: string) {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from('user_tenants')
    .select(`
      tenant_id,
      role,
      tenants (
        id,
        name,
        slug,
        plan,
        settings
      )
    `)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error fetching user tenants:', error)
    return []
  }
  
  return data || []
}

// Check if user has access to a tenant
export async function hasAccessToTenant(userId: string, tenantId: string) {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from('user_tenants')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single()
  
  if (error) {
    return false
  }
  
  return !!data
}

// Get user's role in a tenant
export async function getUserRoleInTenant(userId: string, tenantId: string) {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from('user_tenants')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single()
  
  if (error) {
    return null
  }
  
  return data?.role || null
}

// Check if user has a specific role in a tenant
export function hasRole(role: string, allowedRoles: string[]) {
  return allowedRoles.includes(role)
}

// Role hierarchy helpers
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export function roleAtLeast(userRole: string, requiredRole: string) {
  return (ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0) >= 
         (ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0)
}

