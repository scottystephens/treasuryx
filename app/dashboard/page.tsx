import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAccounts, getTransactions, getPayments } from '@/lib/csv-parser'
import { formatCurrency, convertToUSD, getStatusColor } from '@/lib/utils'
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertCircle,
  DollarSign 
} from 'lucide-react'

async function getDashboardData() {
  const [accounts, transactions, payments] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getPayments()
  ])

  // Calculate total cash in USD
  const totalCashUSD = accounts.reduce((sum, account) => {
    return sum + convertToUSD(account.balance, account.currency)
  }, 0)

  // Calculate cash inflows (last 7 days)
  const recentDate = new Date()
  recentDate.setDate(recentDate.getDate() - 7)
  
  const inflows = transactions
    .filter(t => t.type === 'Credit' && new Date(t.date) >= recentDate)
    .reduce((sum, t) => sum + convertToUSD(t.amount, t.currency), 0)

  const outflows = transactions
    .filter(t => t.type === 'Debit' && new Date(t.date) >= recentDate)
    .reduce((sum, t) => sum + Math.abs(convertToUSD(t.amount, t.currency)), 0)

  const netCashFlow = inflows - outflows

  // Pending payments
  const pendingPayments = payments.filter(p => 
    p.status === 'Pending Approval' || p.status === 'Draft'
  )
  
  const pendingAmount = pendingPayments.reduce((sum, p) => 
    sum + convertToUSD(p.amount, p.currency), 0
  )

  // Recent transactions
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  // Accounts by currency
  const accountsByCurrency = accounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = []
    }
    acc[account.currency].push(account)
    return acc
  }, {} as Record<string, typeof accounts>)

  return {
    totalCashUSD,
    inflows,
    outflows,
    netCashFlow,
    pendingPayments: pendingPayments.length,
    pendingAmount,
    recentTransactions,
    accountsByCurrency,
    accountCount: accounts.length
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time treasury insights and cash visibility
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cash Position</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalCashUSD, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.accountCount} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow (7d)</CardTitle>
            {data.netCashFlow >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.netCashFlow >= 0 ? '+' : ''}{formatCurrency(data.netCashFlow, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              In: {formatCurrency(data.inflows, 'USD')} | Out: {formatCurrency(data.outflows, 'USD')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(data.pendingAmount, 'USD')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89.2%</div>
            <p className="text-xs text-muted-foreground">
              AI-powered predictions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Transactions */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest activity across all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentTransactions.map((transaction) => (
                <div
                  key={transaction.transactionId}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">{transaction.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {transaction.date}
                      </span>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {transaction.category}
                      </span>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    transaction.type === 'Credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'Credit' ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cash by Currency */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Cash by Currency</CardTitle>
            <CardDescription>Distribution across currencies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(data.accountsByCurrency).map(([currency, accounts]) => {
                const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
                const totalUSD = convertToUSD(totalBalance, currency)
                const percentage = (totalUSD / data.totalCashUSD) * 100
                
                return (
                  <div key={currency} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{currency}</p>
                        <p className="text-xs text-muted-foreground">
                          {accounts.length} account{accounts.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(totalBalance, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span>AI-Powered Insights</span>
          </CardTitle>
          <CardDescription>Automated alerts and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Large outflow detected</p>
                <p className="text-sm text-yellow-700">
                  Equipment purchase of €450,000 exceeded typical daily spending by 340%. Forecast adjusted accordingly.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Positive cash trend</p>
                <p className="text-sm text-blue-700">
                  Operating cash flow up 18% week-over-week. Current trajectory suggests strong Q4 performance.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Wallet className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-purple-900">Optimization opportunity</p>
                <p className="text-sm text-purple-700">
                  UK Reserve Account has maintained high balance for 14+ days. Consider moving to higher-yield investment.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

