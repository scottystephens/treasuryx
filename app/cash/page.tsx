'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getStatusColor } from '@/lib/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Activity, Eye } from 'lucide-react'

interface Transaction {
  transactionId: string
  accountId: string
  date: string
  description: string
  amount: number
  currency: string
  type: string
  category: string
  status: string
  reference: string
}

interface Forecast {
  forecastId: string
  date: string
  predictedBalance: number
  actualBalance: number | null
  variance: number
  confidence: number
  entityId: string
  currency: string
  category: string
}

export default function CashPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function fetchData() {
      try {
        const [txnRes, forecastRes] = await Promise.all([
          fetch('/api/transactions'),
          fetch('/api/forecast')
        ])
        const txnData = await txnRes.json()
        const forecastData = await forecastRes.json()
        setTransactions(txnData)
        setForecasts(forecastData)
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

  // Prepare forecast chart data
  const forecastChartData = forecasts
    .filter(f => f.entityId === 'ENT001' && f.currency === 'USD')
    .map(f => ({
      date: new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      predicted: f.predictedBalance / 1000000,
      actual: f.actualBalance ? f.actualBalance / 1000000 : null,
      confidence: f.confidence * 100
    }))

  // Prepare cash flow chart data
  const cashFlowData = transactions
    .reduce((acc, txn) => {
      const date = new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const existing = acc.find(item => item.date === date)
      
      if (existing) {
        if (txn.type === 'Credit') {
          existing.inflow += txn.amount
        } else {
          existing.outflow += Math.abs(txn.amount)
        }
      } else {
        acc.push({
          date,
          inflow: txn.type === 'Credit' ? txn.amount : 0,
          outflow: txn.type === 'Debit' ? Math.abs(txn.amount) : 0
        })
      }
      return acc
    }, [] as { date: string; inflow: number; outflow: number }[])
    .map(item => ({
      date: item.date,
      inflow: item.inflow / 1000,
      outflow: item.outflow / 1000
    }))

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.category.toLowerCase() === filter)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Cash Management</h1>
        <p className="text-muted-foreground">
          Transaction history and AI-powered cash forecasting
        </p>
      </div>

      {/* Forecast Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Cash Forecast - USD (Millions)</span>
          </CardTitle>
          <CardDescription>AI-powered 7-day cash position forecast with confidence intervals</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}M`, '']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Predicted"
                dot={{ fill: '#3b82f6' }}
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Actual"
                dot={{ fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-blue-600"></div>
              <span>AI Forecast</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-green-600"></div>
              <span>Actual</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>Avg Confidence: {(forecastChartData.reduce((sum, d) => sum + d.confidence, 0) / forecastChartData.length).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Daily Cash Flow (Thousands)</span>
          </CardTitle>
          <CardDescription>Inflows vs Outflows across all accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(0)}K`, '']}
              />
              <Legend />
              <Bar dataKey="inflow" fill="#10b981" name="Inflows" />
              <Bar dataKey="outflow" fill="#ef4444" name="Outflows" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Transaction History</span>
          </CardTitle>
          <CardDescription>
            <div className="flex items-center space-x-2 mt-2">
              <span>Filter by:</span>
              {['all', 'operating', 'investing', 'financing'].map(category => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.transactionId} className="border-b last:border-0">
                    <td className="py-3 text-sm text-muted-foreground">{transaction.date}</td>
                    <td className="py-3">
                      <div className="font-medium">{transaction.description}</div>
                      <div className="text-xs text-muted-foreground">{transaction.accountId}</div>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className="text-xs">
                        {transaction.category}
                      </Badge>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">{transaction.reference}</td>
                    <td className="py-3">
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </td>
                    <td className={`py-3 text-right font-semibold ${
                      transaction.type === 'Credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'Credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

