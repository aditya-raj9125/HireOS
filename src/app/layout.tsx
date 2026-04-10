import type { Metadata } from 'next'
import { Instrument_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HireOS — Agentic AI Technical Interview Platform',
  description:
    'Eliminate engineer bandwidth drain. HireOS conducts your full technical interview pipeline autonomously.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              background: '#1C1917',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  )
}
