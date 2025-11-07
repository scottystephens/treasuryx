'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getStatusColor, getPriorityColor, formatDate } from '@/lib/utils'
import { Send, CheckCircle, Clock, FileText, AlertTriangle, Filter } from 'lucide-react'

interface Payment {
  paymentId: string
  fromAccount: string
  toEntity: string
  amount: number
  currency: string
  scheduledDate: string
  status: string
  approver: string
  description: string
  paymentType: string
  priority: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/payments')
        const data = await res.json()
        setPayments(data)
        if (data.length > 0) {
          setSelectedPayment(data[0])
        }
      } catch (error) {
        console.error('Failed to fetch payments:', error)
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

  const filteredPayments = statusFilter === 'all'
    ? payments
    : payments.filter(p => p.status === statusFilter)

  // Calculate statistics
  const stats = {
    total: payments.length,
    pending: payments.filter(p => p.status === 'Pending Approval').length,
    approved: payments.filter(p => p.status === 'Approved').length,
    scheduled: payments.filter(p => p.status === 'Scheduled').length,
    draft: payments.filter(p => p.status === 'Draft').length,
  }

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Payment Management</h1>
        <p className="text-muted-foreground">
          Track and approve payments with full audit trails
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.scheduled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Payments List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payments</span>
              <Filter className="h-4 w-4" />
            </CardTitle>
            <CardDescription>
              <div className="flex flex-wrap gap-1 mt-2">
                {['all', 'Pending Approval', 'Approved', 'Scheduled', 'Draft'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    {status === 'all' ? 'All' : status}
                  </button>
                ))}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredPayments.map(payment => (
                <button
                  key={payment.paymentId}
                  onClick={() => setSelectedPayment(payment)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedPayment?.paymentId === payment.paymentId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{payment.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {payment.toEntity}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                        <Badge className={getPriorityColor(payment.priority)}>
                          {payment.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-semibold">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(payment.scheduledDate)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>
              {selectedPayment?.paymentId} - Complete information and approval workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPayment && (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`p-4 rounded-lg border-2 ${
                  selectedPayment.status === 'Pending Approval' 
                    ? 'bg-orange-50 border-orange-200'
                    : selectedPayment.status === 'Approved'
                    ? 'bg-blue-50 border-blue-200'
                    : selectedPayment.status === 'Scheduled'
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {selectedPayment.status === 'Pending Approval' && (
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                      )}
                      {selectedPayment.status === 'Approved' && (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      )}
                      {selectedPayment.status === 'Scheduled' && (
                        <Clock className="h-5 w-5 text-purple-600" />
                      )}
                      <div>
                        <p className="font-semibold">{selectedPayment.status}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPayment.status === 'Pending Approval' 
                            ? 'Awaiting approval to proceed'
                            : selectedPayment.status === 'Approved'
                            ? 'Ready for processing'
                            : selectedPayment.status === 'Scheduled'
                            ? `Will be processed on ${formatDate(selectedPayment.scheduledDate)}`
                            : 'Not yet submitted'}
                        </p>
                      </div>
                    </div>
                    <Badge className={getPriorityColor(selectedPayment.priority)}>
                      {selectedPayment.priority} Priority
                    </Badge>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Amount</label>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Scheduled Date</label>
                    <p className="mt-1 font-medium">{formatDate(selectedPayment.scheduledDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">From Account</label>
                    <p className="mt-1 font-medium font-mono text-sm">{selectedPayment.fromAccount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">To Entity</label>
                    <p className="mt-1 font-medium">{selectedPayment.toEntity}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                    <p className="mt-1">
                      <Badge variant="outline">{selectedPayment.paymentType}</Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Approver</label>
                    <p className="mt-1 font-medium">{selectedPayment.approver}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="mt-1 font-medium">{selectedPayment.description}</p>
                </div>

                {/* Action Buttons */}
                {selectedPayment.status === 'Pending Approval' && (
                  <div className="flex items-center space-x-3 pt-4 border-t">
                    <button className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                      Approve Payment
                    </button>
                    <button className="flex-1 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg font-medium hover:bg-destructive/90 transition-colors">
                      Reject Payment
                    </button>
                  </div>
                )}

                {selectedPayment.status === 'Draft' && (
                  <div className="flex items-center space-x-3 pt-4 border-t">
                    <button className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                      Submit for Approval
                    </button>
                    <button className="px-4 py-2 rounded-lg font-medium border hover:bg-accent transition-colors">
                      Edit Payment
                    </button>
                  </div>
                )}

                {/* Audit Trail */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Audit Trail</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                      <div className="flex-1">
                        <p className="font-medium">Payment Created</p>
                        <p className="text-muted-foreground text-xs">
                          Created by {selectedPayment.approver} on {formatDate(selectedPayment.scheduledDate)}
                        </p>
                      </div>
                    </div>
                    {selectedPayment.status !== 'Draft' && (
                      <div className="flex items-start space-x-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5"></div>
                        <div className="flex-1">
                          <p className="font-medium">Submitted for Approval</p>
                          <p className="text-muted-foreground text-xs">
                            Submitted to {selectedPayment.approver}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedPayment.status === 'Approved' || selectedPayment.status === 'Scheduled' && (
                      <div className="flex items-start space-x-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5"></div>
                        <div className="flex-1">
                          <p className="font-medium">Approved</p>
                          <p className="text-muted-foreground text-xs">
                            Approved by {selectedPayment.approver}
                          </p>
                        </div>
                      </div>
                    )}
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

