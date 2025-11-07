'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { convertToUSD } from '@/lib/utils'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Activity } from 'lucide-react'

interface Account {
  accountId: string
  currency: string
  balance: number
  entityId: string
  bankName: string
}

interface Transaction {
  transactionId: string
  date: string
  amount: number
  currency: string
  type: string
  category: string
}

interface Entity {
  entityId: string
  entityName: string
  country: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export default function AnalyticsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [accountsRes, txnRes, entitiesRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/transactions'),
          fetch('/api/entities')
        ])
        const accountsData = await accountsRes.json()
        const txnData = await txnRes.json()
        const entitiesData = await entitiesRes.json()
        setAccounts(accountsData)
        setTransactions(txnData)
        setEntities(entitiesData)
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

  // Cash by Entity
  const cashByEntity = entities.map(entity => {
    const entityAccounts = accounts.filter(a => a.entityId === entity.entityId)
    const totalCash = entityAccounts.reduce((sum, acc) => 
      sum + convertToUSD(acc.balance, acc.currency), 0
    )
    return {
      name: entity.entityName,
      value: Math.round(totalCash / 1000000) // Convert to millions
    }
  }).filter(e => e.value > 0)

  // Cash by Currency
  const cashByCurrency = accounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = 0
    }
    acc[account.currency] += convertToUSD(account.balance, account.currency)
    return acc
  }, {} as Record<string, number>)

  const currencyData = Object.entries(cashByCurrency).map(([currency, amount]) => ({
    name: currency,
    value: Math.round(amount / 1000000) // Millions
  }))

  // Cash Flow by Category
  const categoryFlow = transactions.reduce((acc, txn) => {
    if (!acc[txn.category]) {
      acc[txn.category] = { inflow: 0, outflow: 0 }
    }
    const amountUSD = convertToUSD(Math.abs(txn.amount), txn.currency)
    if (txn.type === 'Credit') {
      acc[txn.category].inflow += amountUSD
    } else {
      acc[txn.category].outflow += amountUSD
    }
    return acc
  }, {} as Record<string, { inflow: number; outflow: number }>)

  const categoryData = Object.entries(categoryFlow).map(([category, flow]) => ({
    category,
    inflow: Math.round(flow.inflow / 1000),
    outflow: Math.round(flow.outflow / 1000)
  }))

  // Daily cash trend
  const dailyTrend = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, txn) => {
      const date = txn.date
      const existing = acc.find(item => item.date === date)
      const amountUSD = convertToUSD(txn.amount, txn.currency)
      
      if (existing) {
        existing.balance += amountUSD
      } else {
        const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 45000000
        acc.push({
          date,
          balance: previousBalance + amountUSD
        })
      }
      return acc
    }, [] as { date: string; balance: number }[])
    .map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: Math.round(item.balance / 1000000)
    }))

  // Cash by Bank
  const cashByBank = accounts.reduce((acc, account) => {
    if (!acc[account.bankName]) {
      acc[account.bankName] = 0
    }
    acc[account.bankName] += convertToUSD(account.balance, account.currency)
    return acc
  }, {} as Record<string, number>)

  const bankData = Object.entries(cashByBank).map(([bank, amount]) => ({
    name: bank,
    value: Math.round(amount / 1000000)
  }))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
        <p className="text-muted-foreground">
          Comprehensive treasury analytics and visualization
        </p>
      </div>

      {/* Cash Trend Over Time */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Cash Position Trend (USD Millions)</span>
          </CardTitle>
          <CardDescription>Daily cash position across all accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`$${value}M`, 'Balance']}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorBalance)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Cash by Entity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChartIcon className="h-5 w-5" />
              <span>Cash by Entity (USD Millions)</span>
            </CardTitle>
            <CardDescription>Distribution across legal entities</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cashByEntity}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {cashByEntity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value}M`, 'Cash']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash by Currency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChartIcon className="h-5 w-5" />
              <span>Cash by Currency (USD Millions)</span>
            </CardTitle>
            <CardDescription>Multi-currency breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={currencyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {currencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value}M`, 'Cash']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cash Flow by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Cash Flow by Category (Thousands)</span>
            </CardTitle>
            <CardDescription>Inflows vs Outflows by activity type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`$${value}K`, '']} />
                <Legend />
                <Bar dataKey="inflow" fill="#10b981" name="Inflows" />
                <Bar dataKey="outflow" fill="#ef4444" name="Outflows" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash by Bank */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Cash by Banking Partner (USD Millions)</span>
            </CardTitle>
            <CardDescription>Distribution across financial institutions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bankData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value: number) => [`$${value}M`, 'Cash']} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Key Performance Indicators</CardTitle>
          <CardDescription>Summary of critical treasury metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-2xl font-bold">{accounts.length}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Active Entities</p>
              <p className="text-2xl font-bold">{entities.filter(e => e.entityId.startsWith('ENT')).length}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Countries</p>
              <p className="text-2xl font-bold">{new Set(entities.map(e => e.country)).size}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Currencies</p>
              <p className="text-2xl font-bold">{new Set(accounts.map(a => a.currency)).size}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

