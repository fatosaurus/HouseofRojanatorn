import { useEffect, useState, type ReactNode } from 'react'
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

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  usePageSetup(title)

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
    <div className="marketing-heading">
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
      {pieces.map(piece => (
        <article className="marketing-piece-card" key={piece.name}>
          <div className="marketing-piece-art">
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
        <div className="marketing-hero-dark">
          <p className="marketing-overline">Bangkok atelier since 1984</p>
          <h1>
            Jewels of intention.
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

        <div className="marketing-hero-light">
          <div className="marketing-stat-card">
            <span>Forty years</span>
            <strong>One house, one unbroken thread of making.</strong>
          </div>
          <div className="marketing-hero-gallery">
            <div className="marketing-hero-gallery-main">
              <img
                src={featuredEditorialImages[3].src}
                alt={featuredEditorialImages[3].alt}
                style={{ objectPosition: featuredEditorialImages[3].position ?? 'center' }}
              />
            </div>
            <div className="marketing-hero-gallery-stack">
              {[featuredEditorialImages[0], featuredEditorialImages[5]].map(image => (
                <div className="marketing-hero-gallery-card" key={image.src}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    style={{ objectPosition: image.position ?? 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="marketing-hero-note">
            Every piece begins with listening, moves through drawing and sourcing, and ends only
            when the object feels resolved in the hand and on the body.
          </p>
        </div>
      </section>

      <section className="marketing-section marketing-section-dark">
        <div className="marketing-split-header">
          <SectionHeading
            eyebrow="The collection"
            title="A language of sculpted forms and"
            accent=" luminous materials."
            body="Each piece is conceived as an individual composition, not a variation line. The collection moves between ceremonial scale and intimate everyday wear."
          />
          <Link className="marketing-outline-link light" to="/collection">
            View all pieces
          </Link>
        </div>
        <PieceGrid pieces={homeCollection} />
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel">
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
            {bespokeSteps.map(step => (
              <article className="marketing-step-card" key={step.number}>
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
          <div className="marketing-story-art">
            <img
              src={featuredEditorialImages[2].src}
              alt={featuredEditorialImages[2].alt}
              style={{ objectPosition: featuredEditorialImages[2].position ?? 'center' }}
            />
          </div>
          <div className="marketing-story-copy">
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
        <div className="marketing-split-header">
          <SectionHeading
            eyebrow="The art of making"
            title="An atelier arranged around discipline,"
            accent=" patience, and light."
            body="The studio is neither showroom nor factory. It is a working environment built to help craftsmen focus for hours at a time."
          />
          <Link className="marketing-outline-link light" to="/atelier">
            Visit the atelier
          </Link>
        </div>
        <div className="marketing-feature-grid">
          {atelierHighlights.map(item => (
            <article className="marketing-feature-card" key={item.title}>
              <Hammer />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-split-header">
          <SectionHeading
            eyebrow="Journal"
            title="Stories of craft, stone,"
            accent=" and making."
            body="Essays and portraits from the house, written to document the thinking and hands behind the work."
          />
          <Link className="marketing-outline-link" to="/journal">
            Open the journal
          </Link>
        </div>
        <div className="marketing-journal-grid">
          {journalEntries.slice(0, 3).map(entry => (
            <article className="marketing-journal-card" key={entry.title}>
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
          <div className="marketing-panel">
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
            <div>
              <strong>100%</strong>
              <p>of foundation proceeds are directed toward arts education programs.</p>
            </div>
            <div>
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
        <p className="marketing-overline">Our story</p>
        <h1>
          Forty years. One house.
          <em> An unbroken thread.</em>
        </h1>
        <p>
          The house began with a workbench, a point of view, and the conviction that Thai
          craftsmanship deserved to stand at the center of fine jewelry.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser reverse">
          <div className="marketing-story-copy">
            <SectionHeading
              eyebrow="Where it began"
              title="Bangkok,"
              accent=" 1984."
              body="Rojanatorn started quietly. The original vision was not to produce volume, but to create work with integrity, intimacy, and a strong sense of authorship."
            />
          </div>
          <div className="marketing-quote-panel">
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
          {storyTimeline.map(item => (
            <article className="marketing-timeline-item" key={item.year}>
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
          {storyValues.map(item => (
            <article className="marketing-feature-card" key={item.title}>
              <Gem />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser">
          <div className="marketing-founder-card">
            <span>Founder note</span>
            <p>
              The goal was never to make jewelry that shouted. It was to make work with enough
              clarity and feeling that it would stay with a person for the rest of their life.
            </p>
          </div>
          <div className="marketing-story-copy">
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
        <p className="marketing-overline">The collection</p>
        <h1>
          Each piece made once.
          <em> For one person.</em>
        </h1>
        <p>
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
          <div className="marketing-panel">
            <SectionHeading
              eyebrow="Materials and sourcing"
              title="Every material chosen with"
              accent=" care."
              body="Stones are selected for life and personality, not only grade. Metal tone, finish, and weight are decided in relation to the wearer."
            />
          </div>
          <div className="marketing-stat-block">
            <div>
              <strong>Stone-led</strong>
              <p>The design adapts to the gem, not the other way around.</p>
            </div>
            <div>
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
        <p className="marketing-overline">The atelier</p>
        <h1>
          Where everything
          <em> is made.</em>
        </h1>
        <p>
          The Bangkok atelier is a working studio built around concentration, skill, and the slow
          resolution of detail.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-story-teaser">
          <div className="marketing-story-copy">
            <SectionHeading
              eyebrow="The studio"
              title="A space built for"
              accent=" craft."
              body="The atelier is arranged so that shaping, setting, finishing, and review can happen without noise or interruption. The environment serves the work."
            />
          </div>
          <div className="marketing-art-card">
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
          {atelierHighlights.map(item => (
            <article className="marketing-feature-card" key={item.title}>
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
          {atelierDisciplines.map(item => (
            <article className="marketing-feature-card soft" key={item.title}>
              <Gem />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel">
            <SectionHeading
              eyebrow="A day in the atelier"
              title="Quiet rhythms."
              accent=" Exacting hands."
              body="Most of the work depends on long concentration rather than dramatic gestures."
            />
          </div>
          <div className="marketing-step-list">
            {atelierDay.map(step => (
              <article className="marketing-step-card" key={step.number + step.title}>
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
        <p className="marketing-overline">Bespoke</p>
        <h1>
          Made for you.
          <em> From the beginning.</em>
        </h1>
        <p>
          Bespoke at Rojanatorn means the piece is conceived around a specific person, occasion, and
          emotional register from its very first line.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-two-column">
          <div className="marketing-panel">
            <SectionHeading
              eyebrow="What bespoke means here"
              title="Not custom."
              accent=" Truly bespoke."
              body="The work does not begin from a preset model. We build the concept around the wearer, then source, draw, and make accordingly."
            />
          </div>
          <div className="marketing-step-list">
            {bespokeSteps.map(step => (
              <article className="marketing-step-card" key={step.number}>
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
          {bespokeOccasions.map(item => (
            <article className="marketing-feature-card soft" key={item.title}>
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
          {bespokeFaq.map(item => (
            <article className="marketing-faq-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-cta-banner" id="inquiry">
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
        <p className="marketing-overline">Foundation</p>
        <h1>
          Beauty that
          <em> gives back.</em>
        </h1>
        <p>
          The foundation collection extends the values of the house into art education, using daily
          objects to support the next generation of makers.
        </p>
      </section>

      <section className="marketing-section" id="mission">
        <div className="marketing-two-column">
          <div className="marketing-panel">
            <SectionHeading
              eyebrow="Our mission"
              title="Art education for the next"
              accent=" generation."
              body="The foundation supports programs that keep creative tools, materials, and mentorship visible and accessible for children in Thailand."
            />
          </div>
          <div className="marketing-stat-block">
            <div>
              <strong>100%</strong>
              <p>of foundation proceeds go directly to programs.</p>
            </div>
            <div>
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
          {foundationSupport.map(item => (
            <article className="marketing-step-card" key={item.number + item.title}>
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
        <p className="marketing-overline">Journal</p>
        <h1>
          Stories of craft,
          <em> stone, and making.</em>
        </h1>
        <p>
          Essays from the atelier, portraits of craftsmen, and notes on why certain materials or
          methods remain worth the time they demand.
        </p>
      </section>

      <section className="marketing-section">
        <div className="marketing-featured-journal">
          <div className="marketing-art-card feature">
            <img
              src={featuredEditorialImages[4].src}
              alt={featuredEditorialImages[4].alt}
              style={{ objectPosition: featuredEditorialImages[4].position ?? 'center' }}
            />
            <p>Featured essay</p>
          </div>
          <div className="marketing-story-copy">
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
          {journalEntries.map(entry => (
            <article className="marketing-journal-card" key={entry.title}>
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
