import Link from 'next/link'

export function CTASection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          <div className="grid gap-8 p-8 md:grid-cols-12 md:p-12">
            {/* Left tagline */}
            <div className="md:col-span-5">
              <h2 className="text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl">
                When AI Interviews,
                <br />
                <span className="text-brand-500">Engineers Ship Code.</span>
              </h2>
              <Link
                href="#demo"
                className="mt-6 inline-flex items-center gap-1 text-base font-medium text-brand-500 hover:text-brand-600"
              >
                Book a Demo
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {/* Right mini nav */}
            <div className="grid grid-cols-3 gap-6 md:col-span-7">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">
                  Resources
                </h4>
                <ul className="mt-3 space-y-2">
                  {['Documentation', 'API Reference', 'Changelog'].map(
                    (link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="text-sm text-neutral-500 hover:text-neutral-900"
                        >
                          {link}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">
                  Legal
                </h4>
                <ul className="mt-3 space-y-2">
                  {['Privacy Policy', 'Terms of Service', 'Security'].map(
                    (link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="text-sm text-neutral-500 hover:text-neutral-900"
                        >
                          {link}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">
                  Company
                </h4>
                <ul className="mt-3 space-y-2">
                  {['About', 'Blog', 'Careers'].map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-neutral-500 hover:text-neutral-900"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
