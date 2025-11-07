import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    SGD: 'S$',
  }

  const symbol = currencySymbols[currency] || currency
  
  return `${symbol}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(d)
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'Active': 'text-green-600 bg-green-50',
    'Pending': 'text-yellow-600 bg-yellow-50',
    'Completed': 'text-green-600 bg-green-50',
    'Approved': 'text-blue-600 bg-blue-50',
    'Draft': 'text-gray-600 bg-gray-50',
    'Scheduled': 'text-purple-600 bg-purple-50',
    'Pending Approval': 'text-orange-600 bg-orange-50',
  }
  return statusColors[status] || 'text-gray-600 bg-gray-50'
}

export function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    'High': 'text-red-600 bg-red-50',
    'Medium': 'text-yellow-600 bg-yellow-50',
    'Low': 'text-green-600 bg-green-50',
  }
  return priorityColors[priority] || 'text-gray-600 bg-gray-50'
}

export function convertToUSD(amount: number, currency: string): number {
  // Mock exchange rates - in production, fetch from real-time API
  const exchangeRates: Record<string, number> = {
    USD: 1,
    EUR: 1.08,
    GBP: 1.27,
    JPY: 0.0067,
    CAD: 0.72,
    AUD: 0.65,
    SGD: 0.74,
  }
  
  return amount * (exchangeRates[currency] || 1)
}

