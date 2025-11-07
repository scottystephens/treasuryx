import { Navigation } from '@/components/navigation'

export const metadata = {
  title: 'Exchange Rates - TreasuryX',
  description: 'Real-time USD to major currency exchange rates updated daily',
}

export default function RatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navigation />
      {children}
    </>
  )
}

