import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { TenantProvider } from "@/lib/tenant-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TreasuryX - Modern Treasury Management",
  description: "AI-powered treasury management platform for enterprise cash visibility, entity management, and payment operations",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <TenantProvider>
            {children}
          </TenantProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

