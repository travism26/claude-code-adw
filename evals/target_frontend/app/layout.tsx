import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import QueryProvider from "../components/QueryProvider"
import { ChakraProvider } from "../components/ChakraProvider"

// Inter loaded via next/font (built-in Next.js — no new dependency).
// Exposed as --font-inter CSS variable; consumed by foundations.ts font stack.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GrowBuddy - Plant Care Manager',
  description: 'Track and manage your plant care with GrowBuddy',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ChakraProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ChakraProvider>
      </body>
    </html>
  )
}
