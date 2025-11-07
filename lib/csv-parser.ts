import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'

export interface Account {
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

export interface Entity {
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

export interface Transaction {
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

export interface Payment {
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

export interface Forecast {
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

function parseCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(process.cwd(), filePath)
    const fileContent = fs.readFileSync(fullPath, 'utf-8')
    
    Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[])
      },
      error: (error: Error) => {
        reject(error)
      }
    })
  })
}

export async function getAccounts(): Promise<Account[]> {
  return parseCSV<Account>('data/accounts.csv')
}

export async function getEntities(): Promise<Entity[]> {
  return parseCSV<Entity>('data/entities.csv')
}

export async function getTransactions(): Promise<Transaction[]> {
  return parseCSV<Transaction>('data/transactions.csv')
}

export async function getPayments(): Promise<Payment[]> {
  return parseCSV<Payment>('data/payments.csv')
}

export async function getForecasts(): Promise<Forecast[]> {
  return parseCSV<Forecast>('data/forecast.csv')
}

