export interface NavItem {
  label: string
  to: string
}

export interface CollectionPiece {
  name: string
  material: string
  category: string
  description: string
  imageSrc: string
  imageAlt: string
  imagePosition?: string
}

export interface StepItem {
  number: string
  title: string
  description: string
  note: string
}

export interface TimelineItem {
  year: string
  title: string
  description: string
}

export interface FeatureCard {
  title: string
  description: string
}

export interface JournalEntry {
  category: string
  title: string
  excerpt: string
  readTime: string
}

export interface CollectionCategory {
  id: string
  name: string
  intro: string
  pieces: CollectionPiece[]
}

export interface FeatureImage {
  src: string
  alt: string
  position?: string
}

export const marketingNavItems: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Story', to: '/story' },
  { label: 'Collection', to: '/collection' },
  { label: 'Atelier', to: '/atelier' },
  { label: 'Foundation', to: '/foundation' },
  { label: 'Journal', to: '/journal' }
]

export const homeCollection: CollectionPiece[] = [
  {
    name: 'The Saffron Arc',
    material: 'Yellow sapphire, hand-forged gold',
    category: 'Statement collar',
    description: 'A wide-neck silhouette built around a graduated line of Sri Lankan sapphires.',
    imageSrc: '/images/jewelry/jewelry-01.jpg',
    imageAlt: 'Floral gemstone earrings in a forest setting',
    imagePosition: 'center 36%'
  },
  {
    name: 'Quiet Flame',
    material: 'Mandarin garnet, brushed gold',
    category: 'Cocktail ring',
    description: 'An intense burst of fire set low to the hand for daily wear.',
    imageSrc: '/images/jewelry/jewelry-02.jpg',
    imageAlt: 'Emerald earrings resting on moss',
    imagePosition: 'center 42%'
  },
  {
    name: 'Rain Thread',
    material: 'Diamond melee, white gold',
    category: 'Drop earrings',
    description: 'A narrow vertical composition designed to move like silk in light.',
    imageSrc: '/images/jewelry/jewelry-03.jpg',
    imageAlt: 'Diamond necklace displayed on moss and stone',
    imagePosition: 'center 38%'
  },
  {
    name: 'Moon Vessel',
    material: 'South Sea pearl, rose gold',
    category: 'Pendant',
    description: 'A single pearl suspended in a sculpted cradle with almost architectural restraint.',
    imageSrc: '/images/jewelry/jewelry-04.jpg',
    imageAlt: 'Butterfly-inspired earrings among red flowers',
    imagePosition: 'center 42%'
  },
  {
    name: 'River Signet',
    material: 'Blue spinel, matte gold',
    category: 'Signet ring',
    description: 'A signet language reworked with softened edges and saturated color.',
    imageSrc: '/images/jewelry/jewelry-05.jpg',
    imageAlt: 'Blue gemstone brooch on deep blue agate',
    imagePosition: 'center 38%'
  }
]

export const featuredEditorialImages: FeatureImage[] = [
  {
    src: '/images/jewelry/feature-01.jpg',
    alt: 'Pink and green gemstone bracelet among flowers',
    position: 'center 44%'
  },
  {
    src: '/images/jewelry/feature-02.jpg',
    alt: 'Ornate bracelet arranged across a forest branch',
    position: 'center 44%'
  },
  {
    src: '/images/jewelry/feature-03.jpg',
    alt: 'Malachite statement necklace against moss',
    position: 'center 48%'
  },
  {
    src: '/images/jewelry/feature-04.jpg',
    alt: 'Model wearing a black gemstone necklace',
    position: 'center 26%'
  },
  {
    src: '/images/jewelry/feature-05.jpg',
    alt: 'Pale opal and pearl bracelet on black background',
    position: 'center 44%'
  },
  {
    src: '/images/jewelry/feature-06.jpg',
    alt: 'Blue gemstone necklace styled on a model from the back',
    position: 'center 28%'
  }
]

export const bespokeSteps: StepItem[] = [
  {
    number: '01',
    title: 'Conversation',
    description: 'We begin with the wearer, the occasion, and the emotional weight a jewel should carry.',
    note: 'Private consultation'
  },
  {
    number: '02',
    title: 'Stone direction',
    description: 'Gemstones are sourced or proposed only once the intent of the piece is clear.',
    note: 'Curated selection'
  },
  {
    number: '03',
    title: 'Design study',
    description: 'Sketches, material notes, and proportion studies refine the form before making begins.',
    note: 'Drawings and mockups'
  },
  {
    number: '04',
    title: 'Handmaking',
    description: 'The piece is built in the Bangkok atelier by long-serving craftsmen working from metal and stone.',
    note: 'No shortcuts'
  }
]

export const storyTimeline: TimelineItem[] = [
  {
    year: '1984',
    title: 'The house begins',
    description: 'Rojanatorn opens in Bangkok with a belief that Thai craftsmanship should lead the story, not sit behind it.'
  },
  {
    year: '1997',
    title: 'The atelier moves',
    description: 'The studio settles into its current Bangkok home, designed around light, quiet, and uninterrupted work.'
  },
  {
    year: '2012',
    title: 'A broader language',
    description: 'The house expands from private commissions into a more defined collection vocabulary.'
  },
  {
    year: 'Today',
    title: 'Craft with continuity',
    description: 'The work remains intentionally slow, deeply personal, and centered on pieces made to outlast fashion.'
  }
]

export const storyValues: FeatureCard[] = [
  {
    title: 'Craft before scale',
    description: 'The house chooses methods that protect detail, sensitivity, and finish rather than speed.'
  },
  {
    title: 'Beauty with purpose',
    description: 'Each commission begins with why a piece should exist, not only how it should look.'
  },
  {
    title: 'Thai making at the center',
    description: 'The atelier treats local craftsmanship as authorship, not anonymous production.'
  }
]

export const atelierHighlights: FeatureCard[] = [
  {
    title: 'North-lit workbenches',
    description: 'The studio is arranged around consistent light and movement between disciplines.'
  },
  {
    title: 'Multi-decade craftsmen',
    description: 'Several hands in the atelier have spent most of their working life with the house.'
  },
  {
    title: 'Stone-first sensitivity',
    description: 'Settings are designed to protect the character of a gem rather than overpower it.'
  }
]

export const atelierDisciplines: FeatureCard[] = [
  {
    title: 'Hand fabrication',
    description: 'Metal is shaped from sheet and wire to preserve crispness, tension, and individuality.'
  },
  {
    title: 'Stone setting',
    description: 'Prongs, bezels, and pavé work are treated as structural and visual decisions at once.'
  },
  {
    title: 'Surface finishing',
    description: 'Textures are adjusted piece by piece so the final finish feels resolved rather than decorative.'
  },
  {
    title: 'Proportion control',
    description: 'Balance on the body matters as much as the face of the jewel in a tray.'
  }
]

export const atelierDay: StepItem[] = [
  {
    number: '08',
    title: 'Quiet opening',
    description: 'Benches are prepared, stones are checked, and unfinished work is re-entered with fresh eyes.',
    note: 'Morning light'
  },
  {
    number: '11',
    title: 'Making hours',
    description: 'Filing, soldering, and shaping happen in long uninterrupted runs to protect concentration.',
    note: 'Focused bench work'
  },
  {
    number: '14',
    title: 'Setting and review',
    description: 'Critical setting and fitting decisions are made once forms are stable and surfaces are clean.',
    note: 'Precision stage'
  },
  {
    number: '17',
    title: 'Finish and pause',
    description: 'The day closes with polishing notes, protection for stones, and preparation for the next sitting.',
    note: 'End-of-day checks'
  }
]

export const journalEntries: JournalEntry[] = [
  {
    category: 'Craft portrait',
    title: 'The man who has set stones for forty years',
    excerpt: 'A portrait of patience, repetition, and the discipline required to work at the smallest scale.',
    readTime: '6 min read'
  },
  {
    category: 'Materials',
    title: 'What makes a stone worth waiting for',
    excerpt: 'Not rarity alone. Tone, life, proportion, and how a gem behaves in different light all matter.',
    readTime: '4 min read'
  },
  {
    category: 'House notes',
    title: 'Why the atelier still works by hand',
    excerpt: 'Speed solves some problems. Sensitivity solves the ones we care most about.',
    readTime: '5 min read'
  },
  {
    category: 'Bespoke',
    title: 'A commission begins with listening',
    excerpt: 'The earliest meeting is not about carat weight. It is about the shape of meaning.',
    readTime: '3 min read'
  }
]

export const collectionCategories: CollectionCategory[] = [
  {
    id: 'necklaces',
    name: 'Necklaces',
    intro: 'Lines designed to sit close to the body, from ceremonial collars to quiet pendants.',
    pieces: [
      {
        name: 'Golden Tide',
        material: 'Champagne diamond, yellow gold',
        category: 'Collar',
        description: 'Broad geometry softened by hand-textured gold and low-set diamonds.',
        imageSrc: '/images/jewelry/jewelry-06.jpg',
        imageAlt: 'Purple and green gemstone brooch among thistles',
        imagePosition: 'center 42%'
      },
      {
        name: 'Halo Thread',
        material: 'Diamond, white gold',
        category: 'Pendant',
        description: 'A narrow chain carrying a luminous center stone in a near-weightless frame.',
        imageSrc: '/images/jewelry/jewelry-07.jpg',
        imageAlt: 'Pastel gemstone necklace displayed with shells',
        imagePosition: 'center 42%'
      }
    ]
  },
  {
    id: 'rings',
    name: 'Rings',
    intro: 'Pieces built around touch, balance, and how a jewel lives with the hand.',
    pieces: [
      {
        name: 'Ember Signet',
        material: 'Spessartite garnet, yellow gold',
        category: 'Statement ring',
        description: 'A warm saturated center with softened shoulders and a matte finish.',
        imageSrc: '/images/jewelry/jewelry-08.jpg',
        imageAlt: 'Floral brooch with butterflies in purple flowers',
        imagePosition: 'center 40%'
      },
      {
        name: 'Still Lake',
        material: 'Blue spinel, white gold',
        category: 'Dress ring',
        description: 'A broad stone table held in a restrained frame to let color carry the piece.',
        imageSrc: '/images/jewelry/jewelry-09.jpg',
        imageAlt: 'Multicolored necklace styled in a botanical garden scene',
        imagePosition: 'center 44%'
      }
    ]
  },
  {
    id: 'earrings',
    name: 'Earrings',
    intro: 'Movement, light, and profile are treated as seriously as frontal composition.',
    pieces: [
      {
        name: 'Evening Line',
        material: 'Diamond, platinum-toned gold',
        category: 'Drop earrings',
        description: 'A linear composition tuned for long movement and sharp flashes of light.',
        imageSrc: '/images/jewelry/jewelry-10.jpg',
        imageAlt: 'Pink and green gemstone bracelet surrounded by flowers',
        imagePosition: 'center 42%'
      },
      {
        name: 'Petal Arc',
        material: 'Pink tourmaline, rose gold',
        category: 'Stud earrings',
        description: 'Rounded geometry with tone-on-tone warmth and a soft polished edge.',
        imageSrc: '/images/jewelry/jewelry-11.jpg',
        imageAlt: 'Floral bracelet on a dark forest branch',
        imagePosition: 'center 40%'
      }
    ]
  },
  {
    id: 'bracelets',
    name: 'Bracelets',
    intro: 'Flexible structures and cuffs designed to feel considered from every angle.',
    pieces: [
      {
        name: 'River Hinge',
        material: 'Yellow sapphire, yellow gold',
        category: 'Cuff',
        description: 'A rigid bracelet with articulated internal balance for comfort and control.',
        imageSrc: '/images/jewelry/jewelry-12.jpg',
        imageAlt: 'Cherry-toned earrings displayed with fruit and blue flowers',
        imagePosition: 'center 42%'
      },
      {
        name: 'Quiet Orbit',
        material: 'Pearl, yellow gold',
        category: 'Bracelet',
        description: 'A refined everyday piece with a single luminous point of focus.',
        imageSrc: '/images/jewelry/jewelry-13.jpg',
        imageAlt: 'Green floral brooch with red flowers on stone',
        imagePosition: 'center 44%'
      }
    ]
  }
]

export const bespokeFaq: FeatureCard[] = [
  {
    title: 'What does a commission cost?',
    description: 'Pricing depends on materials, stone selection, scale, and complexity. We usually define a working range after the first conversation.'
  },
  {
    title: 'How long does it take?',
    description: 'Lead time varies by scope, but bespoke work typically spans several weeks because design, sourcing, and handmaking are all sequential.'
  },
  {
    title: 'Can you work with inherited stones?',
    description: 'Yes, after assessment. We review condition, structure, and whether the stone suits the intended setting.'
  },
  {
    title: 'Do you accept remote clients?',
    description: 'Yes. Initial discussions and review checkpoints can happen remotely when an in-person meeting is not practical.'
  }
]

export const bespokeOccasions: FeatureCard[] = [
  {
    title: 'Engagement and marriage',
    description: 'Pieces built around permanence, intimacy, and a life of daily wear.'
  },
  {
    title: 'Milestones and anniversaries',
    description: 'Jewels that mark a specific season, achievement, or shared history.'
  },
  {
    title: 'Personal inheritance',
    description: 'Commissions made to be passed on with context, not just value.'
  }
]

export const foundationProducts: CollectionPiece[] = [
  {
    name: 'Silk Keepsake Pouch',
    material: 'Hand-finished textile',
    category: 'Foundation object',
    description: 'A soft everyday piece made to carry and protect treasured objects.',
    imageSrc: '/images/jewelry/jewelry-14.jpg',
    imageAlt: 'Portrait cameo pendant on a black background',
    imagePosition: 'center 34%'
  },
  {
    name: 'Porcelain Desk Bowl',
    material: 'Glazed ceramic',
    category: 'Homeware',
    description: 'A small vessel for jewelry, notes, or the quiet rituals of a desk.',
    imageSrc: '/images/jewelry/jewelry-15.jpg',
    imageAlt: 'Black gemstone earring worn on model',
    imagePosition: 'center 24%'
  },
  {
    name: 'Printed Artist Scarf',
    material: 'Lightweight woven cloth',
    category: 'Wearable textile',
    description: 'A limited object whose proceeds support arts education directly.',
    imageSrc: '/images/jewelry/jewelry-16.jpg',
    imageAlt: 'Pearl and gemstone necklace on a black background',
    imagePosition: 'center 36%'
  }
]

export const foundationSupport: StepItem[] = [
  {
    number: '01',
    title: 'Buy from the collection',
    description: 'Foundation pieces direct their proceeds toward arts education programs for children across Thailand.',
    note: 'Direct support'
  },
  {
    number: '02',
    title: 'Share the work',
    description: 'Introducing the foundation to people who care about craft and education expands its reach immediately.',
    note: 'Grow awareness'
  },
  {
    number: '03',
    title: 'Commission with intent',
    description: 'A portion of bespoke work also supports the foundation, linking private making with public contribution.',
    note: 'Long-term impact'
  }
]
