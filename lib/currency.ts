// Currency utilities and definitions

export interface Currency {
  code: string
  name: string
  symbol: string
  region: string
}

// Top 20 most liquid currencies in the world (by trading volume)
export const TOP_CURRENCIES: Currency[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', region: 'Eurozone' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', region: 'Japan' },
  { code: 'GBP', name: 'British Pound', symbol: '£', region: 'United Kingdom' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', region: 'Australia' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', region: 'Canada' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', region: 'Switzerland' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', region: 'China' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', region: 'Sweden' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', region: 'New Zealand' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', region: 'Mexico' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', region: 'Singapore' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', region: 'Hong Kong' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', region: 'Norway' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', region: 'South Korea' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', region: 'Turkey' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', region: 'India' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', region: 'Brazil' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', region: 'South Africa' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', region: 'Russia' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', region: 'Denmark' },
]

export const CURRENCY_CODES = TOP_CURRENCIES.map(c => c.code)

export function getCurrencyByCode(code: string): Currency | undefined {
  return TOP_CURRENCIES.find(c => c.code === code)
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode)
  if (!currency) return `${amount.toFixed(2)} ${currencyCode}`
  
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount) + ` ${currency.symbol}`
}

export function formatExchangeRate(rate: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(rate)
}

export interface ExchangeRate {
  id?: number
  currency_code: string
  currency_name: string
  rate: number
  date: string
  source: string
  updated_at?: string
  created_at?: string
}

// Calculate how much foreign currency you get for X USD
export function convertFromUSD(usdAmount: number, rate: number): number {
  return usdAmount * rate
}

// Calculate how much USD you need for X foreign currency
export function convertToUSD(foreignAmount: number, rate: number): number {
  return foreignAmount / rate
}

// Calculate percentage change
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

