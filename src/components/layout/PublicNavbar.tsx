'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bird, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'For Candidates', href: '#candidates' },
]

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex justify-center px-4 pt-3">
      <nav
        className={cn(
          'flex h-[52px] w-full max-w-5xl items-center justify-between rounded-full px-5 transition-all duration-300',
          scrolled
            ? 'border border-white/10 bg-[#111110] shadow-lg'
            : 'bg-transparent'
        )}
        style={{
          opacity: scrolled ? 1 : undefined,
          transform: scrolled ? 'translateY(0)' : undefined,
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Bird
            className={cn(
              'h-5 w-5 transition-colors',
              scrolled ? 'text-white' : 'text-neutral-900'
            )}
          />
          <span
            className={cn(
              'text-base font-bold transition-colors',
              scrolled ? 'text-white' : 'text-neutral-900'
            )}
          >
            HireOS
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                scrolled
                  ? 'text-neutral-300 hover:text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#demo"
            className={cn(
              'text-sm font-medium transition-colors',
              scrolled
                ? 'text-neutral-300 hover:text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            Book a Demo
          </a>
          <Link
            href="/login"
            className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <X
              className={cn(
                'h-5 w-5',
                scrolled ? 'text-white' : 'text-neutral-900'
              )}
            />
          ) : (
            <Menu
              className={cn(
                'h-5 w-5',
                scrolled ? 'text-white' : 'text-neutral-900'
              )}
            />
          )}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="absolute top-[62px] right-4 left-4 z-50 rounded-2xl border border-neutral-200 bg-white p-4 shadow-modal md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <hr className="border-neutral-200" />
            <a
              href="#demo"
              className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Book a Demo
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-600"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
