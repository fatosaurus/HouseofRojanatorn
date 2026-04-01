import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, Gem, Hammer, HeartHandshake, Menu, Sparkles, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  atelierDay,
  atelierDisciplines,
  atelierHighlights,
  bespokeFaq,
  bespokeOccasions,
  bespokeSteps,
  collectionCategories,
  featuredEditorialImages,
  foundationProducts,
  foundationSupport,
  homeCollection,
  journalEntries,
  marketingNavItems,
  storyTimeline,
  storyValues
} from './siteData'

function usePageSetup(title: string) {
  const location = useLocation()

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1)
      window.requestAnimationFrame(() => {
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }

        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.hash, location.pathname])
}

function useMarketingMotion() {
  const location = useLocation()

  useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('.marketing-reveal'))

    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach(target => target.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return
          }

          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px'
      }
    )

    revealTargets.forEach(target => observer.observe(target))

    return () => observer.disconnect()
  }, [location.pathname])

  useEffect(() => {
    const parallaxTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))

    if (!parallaxTargets.length) {
      return
    }

    const updateParallax = () => {
      const viewportHeight = window.innerHeight || 1

      parallaxTargets.forEach(target => {
        const rect = target.getBoundingClientRect()
        const depth = Number(target.dataset.parallax ?? '28')
        const progress = ((rect.top + rect.height / 2) - viewportHeight / 2) / viewportHeight
        const offset = progress * depth * -1

        target.style.setProperty('--parallax-shift', `${offset.toFixed(2)}px`)
      })
    }

    updateParallax()
    window.addEventListener('scroll', updateParallax, { passive: true })
    window.addEventListener('resize', updateParallax)

    return () => {
      window.removeEventListener('scroll', updateParallax)
      window.removeEventListener('resize', updateParallax)
    }
  }, [location.pathname])
}

function staggerStyle(index: number, step = 90, base = 0): CSSProperties {
  return {
    '--reveal-delay': `${base + index * step}ms`
  } as CSSProperties
}

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  usePageSetup(title)
  useMarketingMotion()

  return (
    <div className="marketing-page">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
      <Link className="marketing-float" to="/bespoke#inquiry">
        <span className="marketing-float-dot" />
        Book a consultation
      </Link>
    </div>
  )
}

function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24)
    }

    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`marketing-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="marketing-nav-shell">
        <Link className="marketing-logo" to="/">
          House of Rojanatorn
        </Link>

        <button
          type="button"
          className="marketing-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <div className={`marketing-nav-links ${menuOpen ? 'is-open' : ''}`}>
          {marketingNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <Link className="marketing-nav-cta" to="/bespoke#inquiry" onClick={() => setMenuOpen(false)}>
            Begin a commission
          </Link>
        </div>
      </div>
    </header>
  )
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-grid">
        <div>
          <p className="marketing-footer-brand">House of Rojanatorn</p>
          <p className="marketing-footer-copy">
            Bespoke jewelry and quietly sculpted objects, handcrafted in Bangkok with a devotion to
            permanence, proportion, and feeling.
          </p>
        </div>
        <div>
          <p className="marketing-footer-title">The House</p>
          <div className="marketing-footer-links">
            <Link to="/story">Our Story</Link>
            <Link to="/atelier">The Atelier</Link>
            <Link to="/bespoke">Bespoke</Link>
            <Link to="/journal">Journal</Link>
          </div>
        </div>
        <div>
          <p className="marketing-footer-title">Collection</p>
          <div className="marketing-footer-links">
            <Link to="/collection#necklaces">Necklaces</Link>
            <Link to="/collection#rings">Rings</Link>
            <Link to="/collection#earrings">Earrings</Link>
            <Link to="/collection#bracelets">Bracelets</Link>
          </div>
        </div>
        <div>
          <p className="marketing-footer-title">Visit</p>
          <div className="marketing-footer-links">
            <Link to="/foundation#mission">Foundation</Link>
            <Link to="/bespoke#inquiry">Appointments</Link>
            <Link to="/journal">Journal</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({
  eyebrow,
  title,
  accent,
  body
}: {
  eyebrow: string
  title: string
  accent?: string
  body?: string
}) {
  return (
    <div className="marketing-heading marketing-reveal">
      <p className="marketing-eyebrow">{eyebrow}</p>
      <h2>
        {title}
        {accent ? <em>{accent}</em> : null}
      </h2>
      {body ? <p>{body}</p> : null}
    </div>
  )
}

function PieceGrid({ pieces }: { pieces: typeof homeCollection }) {
  return (
    <div className="marketing-piece-grid">
      {pieces.map((piece, index) => (
        <article className="marketing-piece-card marketing-reveal" key={piece.name} style={staggerStyle(index)}>
          <div className="marketing-piece-art" data-parallax="18">
            <img
              src={piece.imageSrc}
              alt={piece.imageAlt}
              loading="lazy"
              style={{ objectPosition: piece.imagePosition ?? 'center' }}
            />
          </div>
          <div className="marketing-piece-meta">
            <p>{piece.category}</p>
            <h3>{piece.name}</h3>
            <span>{piece.material}</span>
            <p>{piece.description}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

export function HomePage() {
  return (
    <PageFrame title="House of Rojanatorn - Jewels of Intention">
      <section className="marketing-hero">
        <div className="marketing-hero-dark marketing-reveal">
          <div className="marketing-hero-ornament marketing-reveal" style={staggerStyle(0, 0, 40)}>
            <span>House of Rojanatorn</span>
            <span>Bangkok atelier since 1984</span>
          </div>
          <div className="marketing-hero-copy">
            <p className="marketing-overline">Bangkok atelier since 1984</p>
            <h1>
              Jewels of
              <span> intention.</span>
              <em> Made with restraint.</em>
            </h1>
            <p>
              House of Rojanatorn creates bespoke jewelry and singular pieces shaped by Thai
              craftsmanship, emotional clarity, and a belief that beauty should feel inevitable.
            </p>
            <div className="marketing-hero-actions">
              <Link className="marketing-link-cta" to="/collection">
                Explore the collection
                <ArrowRight />
              </Link>
              <Link className="marketing-subtle-link" to="/bespoke">
                Begin a commission
              </Link>
            </div>
          </div>
          <div className="marketing-hero-ledger marketing-reveal" style={staggerStyle(0, 0, 180)}>
            <div>
              <span>Private commissions</span>
              <strong>Jewelry conceived for one wearer at a time.</strong>
            </div>
            <p>Designed in conversation. Built in the Bangkok atelier. Resolved by hand.</p>
          </div>
        </div>

        <div className="marketing-hero-light marketing-reveal" style={staggerStyle(1, 120, 80)}>
          <div className="marketing-stat-card marketing-reveal" style={staggerStyle(0, 0, 220)}>
            <span>Forty years</span>
            <strong>One house, one unbroken thread of making.</strong>
          </div>
          <div className="marketing-hero-gallery">
            <div className="marketing-hero-gallery-main marketing-reveal" data-parallax="22" style={staggerStyle(0, 0, 280)}>
              <div className="marketing-hero-gallery-frame" />
              <img
                src={featuredEditorialImages[3].src}
                alt={featuredEditorialImages[3].alt}
                style={{ objectPosition: featuredEditorialImages[3].position ?? 'center' }}
              />
            </div>
            <div className="marketing-hero-gallery-stack">
              {[featuredEditorialImages[0], featuredEditorialImages[5]].map((image, index) => (
                <div
                  className="marketing-hero-gallery-card marketing-reveal"
                  key={image.src}
                  data-parallax="18"
                  style={staggerStyle(index, 110, 360)}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    style={{ objectPosition: image.position ?? 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="marketing-hero-foot marketing-reveal" style={staggerStyle(0, 0, 430)}>
            <p className="marketing-hero-note">
              Every piece begins with listening, moves through drawing and sourcing, and ends only
              when the object feels resolved in the hand and on the body.
            </p>
            <p className="marketing-hero-caption">Bespoke jewelry, singular objects, and material studies.</p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <div className="marketing-split-header marketing-section-intro">
          <SectionHeading
            eyebrow="The collection"
            title="A language of sculpted forms and"
            accent=" luminous materials."
            body="Each piece is conceived as an individual composition, not a variation line. The collection moves between ceremonial scale and intimate everyday wear."
          />
          <Link className="marketing-outline-link light marketing-reveal" to="/collection" style={staggerStyle(0, 0, 120)}>
            View all pieces
          </Link>
        </div>
        <PieceGrid pieces={homeCollection} />
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="The bespoke journey"
              title="How a jewel comes to"
              accent=" life."
              body="Our process is private, sequential, and intentionally slow. Each stage exists to protect meaning, proportion, and finish."
            />
            <Link className="marketing-outline-link" to="/bespoke">
              See the full process
            </Link>
          </div>
          <div className="marketing-step-list">
            {bespokeSteps.map((step, index) => (
              <article className="marketing-step-card marketing-reveal" key={step.number} style={staggerStyle(index, 100, 80)}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <small>{step.note}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <div className="marketing-story-teaser">
          <div className="marketing-story-art marketing-reveal" data-parallax="20">
            <img
              src={featuredEditorialImages[2].src}
              alt={featuredEditorialImages[2].alt}
              style={{ objectPosition: featuredEditorialImages[2].position ?? 'center' }}
            />
          </div>
          <div className="marketing-story-copy marketing-reveal" style={staggerStyle(0, 0, 100)}>
            <SectionHeading
              eyebrow="The Rojanatorn story"
              title="A house built on"
              accent=" devotion."
              body="The atelier began in Bangkok in 1984 with a belief that craft should stay visible in the finished object. That standard still defines the work."
            />
            <Link className="marketing-link-cta dark" to="/story">
              Read our story
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <div className="marketing-split-header marketing-section-intro">
          <SectionHeading
            eyebrow="The art of making"
            title="An atelier arranged around discipline,"
            accent=" patience, and light."
            body="The studio is neither showroom nor factory. It is a working environment built to help craftsmen focus for hours at a time."
          />
          <Link className="marketing-outline-link light marketing-reveal" to="/atelier" style={staggerStyle(0, 0, 120)}>
            Visit the atelier
          </Link>
        </div>
        <div className="marketing-feature-grid">
          {atelierHighlights.map((item, index) => (
            <article className="marketing-feature-card marketing-reveal" key={item.title} style={staggerStyle(index, 100, 80)}>
              <Hammer />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-split-header marketing-section-intro">
          <SectionHeading
            eyebrow="Journal"
            title="Stories of craft, stone,"
            accent=" and making."
            body="Essays and portraits from the house, written to document the thinking and hands behind the work."
          />
          <Link className="marketing-outline-link marketing-reveal" to="/journal" style={staggerStyle(0, 0, 120)}>
            Open the journal
          </Link>
        </div>
        <div className="marketing-journal-grid">
          {journalEntries.slice(0, 3).map((entry, index) => (
            <article className="marketing-journal-card marketing-reveal" key={entry.title} style={staggerStyle(index, 90, 80)}>
              <span>{entry.category}</span>
              <h3>{entry.title}</h3>
              <p>{entry.excerpt}</p>
              <small>{entry.readTime}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="Foundation"
              title="Beauty that gives"
              accent=" back."
              body="The foundation extends the house into education, supporting the next generation of Thai makers through thoughtful objects of daily use."
            />
            <Link className="marketing-link-cta dark" to="/foundation">
              Explore the foundation
              <ArrowRight />
            </Link>
          </div>
          <div className="marketing-stat-block">
            <div className="marketing-reveal" style={staggerStyle(0, 0, 80)}>
              <strong>100%</strong>
              <p>of foundation proceeds are directed toward arts education programs.</p>
            </div>
            <div className="marketing-reveal" style={staggerStyle(0, 0, 180)}>
              <strong>1 idea</strong>
              <p>Making something beautiful and supporting beauty in others should not be separate acts.</p>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  )
}

export function StoryPage() {
  return (
    <PageFrame title="Our Story - House of Rojanatorn">
      <section className="marketing-page-hero story">
        <p className="marketing-overline marketing-reveal">Our story</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Forty years. One house.
          <em> An unbroken thread.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          The house began with a workbench, a point of view, and the conviction that Thai
          craftsmanship deserved to stand at the center of fine jewelry.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser reverse">
          <div className="marketing-story-copy marketing-reveal">
            <SectionHeading
              eyebrow="Where it began"
              title="Bangkok,"
              accent=" 1984."
              body="Rojanatorn started quietly. The original vision was not to produce volume, but to create work with integrity, intimacy, and a strong sense of authorship."
            />
          </div>
          <div className="marketing-quote-panel marketing-reveal" style={staggerStyle(0, 0, 100)}>
            <p>
              A house is not built from branding first. It is built from repeated acts of care that
              clients eventually recognize as a standard.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <SectionHeading
          eyebrow="Four decades"
          title="A history of"
          accent=" making."
          body="The shape of the house has changed over time. The underlying discipline has not."
        />
        <div className="marketing-timeline">
          {storyTimeline.map((item, index) => (
            <article className="marketing-timeline-item marketing-reveal" key={item.year} style={staggerStyle(index, 90, 60)}>
              <span>{item.year}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <SectionHeading
          eyebrow="What we believe"
          title="The Rojanatorn"
          accent=" philosophy."
          body="The house continues to make decisions through a few durable principles."
        />
        <div className="marketing-feature-grid">
          {storyValues.map((item, index) => (
            <article className="marketing-feature-card marketing-reveal" key={item.title} style={staggerStyle(index, 100, 80)}>
              <Gem />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser">
          <div className="marketing-founder-card marketing-reveal">
            <span>Founder note</span>
            <p>
              The goal was never to make jewelry that shouted. It was to make work with enough
              clarity and feeling that it would stay with a person for the rest of their life.
            </p>
          </div>
          <div className="marketing-story-copy marketing-reveal" style={staggerStyle(0, 0, 100)}>
            <SectionHeading
              eyebrow="The house today"
              title="Still personal."
              accent=" Still exacting."
              body="The atelier remains small by design. The work is carried by continuity: craftsmen who know the language of the house and clients who come for intimacy rather than spectacle."
            />
            <Link className="marketing-outline-link" to="/atelier">
              See the atelier
            </Link>
          </div>
        </div>
      </section>
    </PageFrame>
  )
}

export function CollectionPage() {
  return (
    <PageFrame title="The Collection - House of Rojanatorn">
      <section className="marketing-page-hero collection">
        <p className="marketing-overline marketing-reveal">The collection</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Each piece made once.
          <em> For one person.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          The collection is shaped by emotional clarity rather than trend cycles. Forms are edited
          until they feel calm, inevitable, and lasting.
        </p>
      </section>

      <section className="marketing-section">
        {collectionCategories.map(category => (
          <div className="marketing-collection-section" id={category.id} key={category.id}>
            <SectionHeading eyebrow={category.name} title={category.name} body={category.intro} />
            <PieceGrid pieces={category.pieces} />
          </div>
        ))}
      </section>

      <section className="marketing-section marketing-section-soft">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="Materials and sourcing"
              title="Every material chosen with"
              accent=" care."
              body="Stones are selected for life and personality, not only grade. Metal tone, finish, and weight are decided in relation to the wearer."
            />
          </div>
          <div className="marketing-stat-block">
            <div className="marketing-reveal" style={staggerStyle(0, 0, 80)}>
              <strong>Stone-led</strong>
              <p>The design adapts to the gem, not the other way around.</p>
            </div>
            <div className="marketing-reveal" style={staggerStyle(0, 0, 180)}>
              <strong>Made by hand</strong>
              <p>Form and finish are tuned manually so the final object stays singular.</p>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  )
}

export function AtelierPage() {
  return (
    <PageFrame title="The Atelier - House of Rojanatorn">
      <section className="marketing-page-hero atelier">
        <p className="marketing-overline marketing-reveal">The atelier</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Where everything
          <em> is made.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          The Bangkok atelier is a working studio built around concentration, skill, and the slow
          resolution of detail.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser">
          <div className="marketing-story-copy marketing-reveal">
            <SectionHeading
              eyebrow="The studio"
              title="A space built for"
              accent=" craft."
              body="The atelier is arranged so that shaping, setting, finishing, and review can happen without noise or interruption. The environment serves the work."
            />
          </div>
          <div className="marketing-art-card marketing-reveal" data-parallax="18" style={staggerStyle(0, 0, 100)}>
            <img
              src={featuredEditorialImages[1].src}
              alt={featuredEditorialImages[1].alt}
              style={{ objectPosition: featuredEditorialImages[1].position ?? 'center' }}
            />
            <p>Light, order, and quiet are treated as tools.</p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <SectionHeading
          eyebrow="The craftsmen"
          title="The hands behind every"
          accent=" piece."
          body="The atelier is defined as much by continuity of people as by continuity of style."
        />
        <div className="marketing-feature-grid">
          {atelierHighlights.map((item, index) => (
            <article className="marketing-feature-card marketing-reveal" key={item.title} style={staggerStyle(index, 100, 80)}>
              <Sparkles />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <SectionHeading
          eyebrow="How we work"
          title="Techniques and"
          accent=" disciplines."
          body="The house uses a mix of fabrication, setting, finishing, and constant proportion checks to keep work refined."
        />
        <div className="marketing-feature-grid compact">
          {atelierDisciplines.map((item, index) => (
            <article className="marketing-feature-card soft marketing-reveal" key={item.title} style={staggerStyle(index, 80, 60)}>
              <Gem />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="A day in the atelier"
              title="Quiet rhythms."
              accent=" Exacting hands."
              body="Most of the work depends on long concentration rather than dramatic gestures."
            />
          </div>
          <div className="marketing-step-list">
            {atelierDay.map((step, index) => (
              <article className="marketing-step-card marketing-reveal" key={step.number + step.title} style={staggerStyle(index, 100, 80)}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <small>{step.note}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  )
}

export function BespokePage() {
  return (
    <PageFrame title="Bespoke - House of Rojanatorn">
      <section className="marketing-page-hero bespoke">
        <p className="marketing-overline marketing-reveal">Bespoke</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Made for you.
          <em> From the beginning.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          Bespoke at Rojanatorn means the piece is conceived around a specific person, occasion, and
          emotional register from its very first line.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="What bespoke means here"
              title="Not custom."
              accent=" Truly bespoke."
              body="The work does not begin from a preset model. We build the concept around the wearer, then source, draw, and make accordingly."
            />
          </div>
          <div className="marketing-step-list">
            {bespokeSteps.map((step, index) => (
              <article className="marketing-step-card marketing-reveal" key={step.number} style={staggerStyle(index, 100, 80)}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <small>{step.note}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <SectionHeading
          eyebrow="Occasions we dress"
          title="Made for life's"
          accent=" defining moments."
          body="Many commissions begin around a life event, but the goal is always the same: a piece that remains meaningful once the event has passed."
        />
        <div className="marketing-feature-grid">
          {bespokeOccasions.map((item, index) => (
            <article className="marketing-feature-card soft marketing-reveal" key={item.title} style={staggerStyle(index, 100, 80)}>
              <HeartHandshake />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <SectionHeading
          eyebrow="Questions answered"
          title="Details before the"
          accent=" first meeting."
          body="The early conversation should feel clear, not intimidating."
        />
        <div className="marketing-faq-grid">
          {bespokeFaq.map((item, index) => (
            <article className="marketing-faq-card marketing-reveal" key={item.title} style={staggerStyle(index, 80, 60)}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-cta-banner marketing-reveal" id="inquiry">
          <div>
            <p className="marketing-eyebrow">Begin with a conversation</p>
            <h2>Private consultations are arranged case by case.</h2>
            <p>
              This site is ready for appointment traffic, but the direct contact channel still needs
              your real studio number or inquiry email before launch.
            </p>
          </div>
          <div className="marketing-cta-actions">
            <Link className="marketing-nav-cta" to="/journal">
              View the journal
            </Link>
          </div>
        </div>
      </section>
    </PageFrame>
  )
}

export function FoundationPage() {
  return (
    <PageFrame title="Foundation - House of Rojanatorn">
      <section className="marketing-page-hero foundation">
        <p className="marketing-overline marketing-reveal">Foundation</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Beauty that
          <em> gives back.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          The foundation collection extends the values of the house into art education, using daily
          objects to support the next generation of makers.
        </p>
      </section>

      <section className="marketing-section" id="mission">
        <div className="marketing-two-column">
          <div className="marketing-panel marketing-reveal">
            <SectionHeading
              eyebrow="Our mission"
              title="Art education for the next"
              accent=" generation."
              body="The foundation supports programs that keep creative tools, materials, and mentorship visible and accessible for children in Thailand."
            />
          </div>
          <div className="marketing-stat-block">
            <div className="marketing-reveal" style={staggerStyle(0, 0, 80)}>
              <strong>100%</strong>
              <p>of foundation proceeds go directly to programs.</p>
            </div>
            <div className="marketing-reveal" style={staggerStyle(0, 0, 180)}>
              <strong>Every object</strong>
              <p>is designed to feel useful, beautiful, and easy to live with.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-soft" id="collection">
        <SectionHeading
          eyebrow="The foundation collection"
          title="Objects of"
          accent=" daily beauty."
          body="Made with the same seriousness around material and finish, but intended for everyday rituals rather than formal occasions."
        />
        <PieceGrid pieces={foundationProducts} />
      </section>

      <section className="marketing-section marketing-section-dark" id="impact">
        <SectionHeading
          eyebrow="How to support"
          title="Three ways to"
          accent=" contribute."
          body="The foundation is structured to make support direct and easy to understand."
        />
        <div className="marketing-step-list three-up">
          {foundationSupport.map((item, index) => (
            <article className="marketing-step-card marketing-reveal" key={item.number + item.title} style={staggerStyle(index, 100, 80)}>
              <span>{item.number}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>{item.note}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageFrame>
  )
}

export function JournalPage() {
  return (
    <PageFrame title="Journal - House of Rojanatorn">
      <section className="marketing-page-hero journal">
        <p className="marketing-overline marketing-reveal">Journal</p>
        <h1 className="marketing-reveal" style={staggerStyle(0, 0, 60)}>
          Stories of craft,
          <em> stone, and making.</em>
        </h1>
        <p className="marketing-reveal" style={staggerStyle(0, 0, 120)}>
          Essays from the atelier, portraits of craftsmen, and notes on why certain materials or
          methods remain worth the time they demand.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-featured-journal">
          <div className="marketing-art-card feature marketing-reveal" data-parallax="18">
            <img
              src={featuredEditorialImages[4].src}
              alt={featuredEditorialImages[4].alt}
              style={{ objectPosition: featuredEditorialImages[4].position ?? 'center' }}
            />
            <p>Featured essay</p>
          </div>
          <div className="marketing-story-copy marketing-reveal" style={staggerStyle(0, 0, 100)}>
            <span className="marketing-overline">Craft portrait</span>
            <h2>The man who has set stones for forty years</h2>
            <p>
              A portrait of one of the atelier's longest-serving craftsmen, and of the discipline
              required to build a life around tiny acts of exactness.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-soft">
        <div className="marketing-journal-grid">
          {journalEntries.map((entry, index) => (
            <article className="marketing-journal-card marketing-reveal" key={entry.title} style={staggerStyle(index, 90, 60)}>
              <span>{entry.category}</span>
              <h3>{entry.title}</h3>
              <p>{entry.excerpt}</p>
              <small>{entry.readTime}</small>
            </article>
          ))}
        </div>
      </section>
    </PageFrame>
  )
}
