'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth-context'
import { supabase } from './supabase-client'

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  settings: {
    currency: string
    timezone: string
    date_format: string
  }
}

interface UserTenant {
  tenant_id: string
  role: string
  tenants: Tenant
}

interface TenantContextType {
  currentTenant: Tenant | null
  userTenants: UserTenant[]
  loading: boolean
  switchTenant: (tenantId: string) => void
  refreshTenants: () => Promise<void>
  userRole: string | null
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [userTenants, setUserTenants] = useState<UserTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const persistTenantId = (tenantId: string | null) => {
    if (typeof window === 'undefined') return
    if (tenantId) {
      localStorage.setItem('currentTenantId', tenantId)
    } else {
      localStorage.removeItem('currentTenantId')
    }
  }

  const applyTenantSelection = useCallback((tenant?: UserTenant) => {
    if (tenant) {
      setCurrentTenant(tenant.tenants)
      setUserRole(tenant.role)
      persistTenantId(tenant.tenant_id)
    } else {
      setCurrentTenant(null)
      setUserRole(null)
      persistTenantId(null)
    }
    queryClient.invalidateQueries({ predicate: () => true })
  }, [queryClient])

  // Fetch user's tenants
  const fetchUserTenants = useCallback(async () => {
    setLoading(true)

    if (!user) {
      setUserTenants([])
      applyTenantSelection(undefined)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
          tenant_id,
          role,
          tenants!inner (
            id,
            name,
            slug,
            plan,
            settings
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Transform the data to match our UserTenant interface
      const userTenantsData = (data || []).map((item: any) => ({
        tenant_id: item.tenant_id,
        role: item.role,
        tenants: Array.isArray(item.tenants) ? item.tenants[0] : item.tenants
      }))

      setUserTenants(userTenantsData as UserTenant[])

      // Set current tenant from localStorage or use first tenant
      const savedTenantId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentTenantId') 
        : null

      const savedTenant = savedTenantId
        ? userTenantsData.find((ut: UserTenant) => ut.tenant_id === savedTenantId)
        : undefined

      if (savedTenant) {
        applyTenantSelection(savedTenant)
      } else if (userTenantsData.length > 0) {
        applyTenantSelection(userTenantsData[0])
      } else {
        applyTenantSelection(undefined)
      }
    } catch (error) {
      console.error('Error fetching user tenants:', error)
      applyTenantSelection(undefined)
    } finally {
      setLoading(false)
    }
  }, [user, applyTenantSelection])

  // Switch tenant
  const switchTenant = (tenantId: string) => {
    const tenant = userTenants.find((ut) => ut.tenant_id === tenantId)
    if (tenant) {
      applyTenantSelection(tenant)
    }
  }

  // Refresh tenants list
  const refreshTenants = async () => {
    await fetchUserTenants()
  }

  // Load tenants when user changes
  useEffect(() => {
    fetchUserTenants()
  }, [fetchUserTenants])

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        userTenants,
        loading,
        switchTenant,
        refreshTenants,
        userRole,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

