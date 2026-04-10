import Link from 'next/link'
import { Bird } from 'lucide-react'

const footerColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#product' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Security', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API Docs', href: '#' },
      { label: 'Integrations', href: '#' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
]

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left tagline column */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 mb-6">
              <Bird className="h-5 w-5 text-brand-500" />
              <span className="text-base font-bold text-neutral-900">HireOS</span>
            </div>
            <h3 className="text-3xl font-medium leading-tight text-neutral-900">
              When <span className="text-brand-500">AI Interviews</span>,
              <br />
              Engineers Ship.
            </h3>
            <Link
              href="#demo"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600"
            >
              Book a Demo
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h4 className="text-sm font-semibold text-neutral-900">
                  {column.title}
                </h4>
                <ul className="mt-3 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
          <p className="text-sm text-neutral-400">
            © {new Date().getFullYear()} HireOS Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-neutral-400 transition-colors hover:text-neutral-900"
              aria-label="LinkedIn"
            >
              <LinkedInIcon className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-neutral-400 transition-colors hover:text-neutral-900"
              aria-label="X (Twitter)"
            >
              <XIcon className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-neutral-400 transition-colors hover:text-neutral-900"
              aria-label="GitHub"
            >
              <GitHubIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
