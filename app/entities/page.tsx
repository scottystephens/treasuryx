'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, convertToUSD, getStatusColor, formatDate } from '@/lib/utils'
import { Building2, Landmark, Globe, FileText } from 'lucide-react'

interface Entity {
  entityId: string
  entityName: string
  legalName: string
  country: string
  taxId: string
  entityType: string
  parentEntity: string
  status: string
  incorporationDate: string
}

interface Account {
  accountId: string
  accountName: string
  accountNumber: string
  currency: string
  balance: number
  entityId: string
  bankName: string
  accountType: string
  status: string
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [entitiesRes, accountsRes] = await Promise.all([
          fetch('/api/entities'),
          fetch('/api/accounts')
        ])
        const entitiesData = await entitiesRes.json()
        const accountsData = await accountsRes.json()
        setEntities(entitiesData)
        setAccounts(accountsData)
        if (entitiesData.length > 0) {
          setSelectedEntity(entitiesData[0].entityId)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const currentEntity = entities.find(e => e.entityId === selectedEntity)
  const entityAccounts = accounts.filter(a => a.entityId === selectedEntity)
  const totalEntityCash = entityAccounts.reduce((sum, acc) => 
    sum + convertToUSD(acc.balance, acc.currency), 0
  )

  // Calculate entity statistics
  const entityStats = entities.map(entity => {
    const entityAccs = accounts.filter(a => a.entityId === entity.entityId)
    const totalCash = entityAccs.reduce((sum, acc) => 
      sum + convertToUSD(acc.balance, acc.currency), 0
    )
    return {
      entity,
      accountCount: entityAccs.length,
      totalCash,
      currencies: [...new Set(entityAccs.map(a => a.currency))]
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Entity Management</h1>
        <p className="text-muted-foreground">
          Legal entities and banking relationships
        </p>
      </div>

      {/* Entity Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entities.length}</div>
            <p className="text-xs text-muted-foreground">
              {entities.filter(e => e.status === 'Active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {[...new Set(accounts.map(a => a.bankName))].length} banks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Countries</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...new Set(entities.map(e => e.country))].length}
            </div>
            <p className="text-xs text-muted-foreground">
              Global presence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currencies</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...new Set(accounts.map(a => a.currency))].length}
            </div>
            <p className="text-xs text-muted-foreground">
              Multi-currency operations
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Entity List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Legal Entities</CardTitle>
            <CardDescription>Select an entity to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entityStats.map(({ entity, accountCount, totalCash }) => (
                <button
                  key={entity.entityId}
                  onClick={() => setSelectedEntity(entity.entityId)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedEntity === entity.entityId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{entity.entityName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {entity.country}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getStatusColor(entity.status)}>
                          {entity.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {accountCount} accounts
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(totalCash, 'USD')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entity Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Entity Details</CardTitle>
            <CardDescription>
              {currentEntity?.entityName} - Complete information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentEntity && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Legal Name</label>
                    <p className="mt-1 font-medium">{currentEntity.legalName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
                    <p className="mt-1 font-medium">{currentEntity.entityType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Country</label>
                    <p className="mt-1 font-medium">{currentEntity.country}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                    <p className="mt-1 font-medium font-mono text-sm">{currentEntity.taxId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Incorporation Date</label>
                    <p className="mt-1 font-medium">{formatDate(currentEntity.incorporationDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(currentEntity.status)}>
                        {currentEntity.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Cash Summary */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center space-x-2">
                    <Landmark className="h-4 w-4" />
                    <span>Cash Position</span>
                  </h4>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Cash (USD Equivalent)</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(totalEntityCash, 'USD')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Accounts */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Bank Accounts ({entityAccounts.length})</h4>
                  <div className="space-y-3">
                    {entityAccounts.map(account => (
                      <div
                        key={account.accountId}
                        className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{account.accountName}</p>
                              <Badge className={getStatusColor(account.status)}>
                                {account.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {account.bankName}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                              <span>{account.accountNumber}</span>
                              <span>•</span>
                              <span>{account.accountType}</span>
                              <span>•</span>
                              <span>{account.currency}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {formatCurrency(account.balance, account.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(convertToUSD(account.balance, account.currency), 'USD')} USD
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

