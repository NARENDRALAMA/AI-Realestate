/**
 * Tutorials shown in the app (/app/learn) and on the public site (/guides).
 * Every instruction here describes how REM Content Studio actually works today.
 */

export interface GuideSection {
  heading: string
  paragraphs?: string[]
  steps?: string[]
  tips?: string[]
  example?: { label: string; bad?: string; good: string }
}

export interface Guide {
  slug: string
  title: string
  summary: string
  minutes: number
  level: 'Getting started' | 'Writing' | 'Workflow' | 'For admins'
  sections: GuideSection[]
  related?: string[]
}

export const guides: Guide[] = [
  {
    slug: 'getting-started',
    title: 'Your first listing in five minutes',
    summary: 'The whole flow once, start to finish: details, settings, live generation, review and export.',
    minutes: 5,
    level: 'Getting started',
    sections: [
      {
        heading: 'Before you start',
        paragraphs: [
          'Have the basics to hand: the listing title, suburb, price (if you’re disclosing it), bedroom, bathroom and parking counts, and a few genuine selling points.',
          'Not ready with a real property? Use “Fill with sample” on the first step to try everything with the built-in example.',
        ],
      },
      {
        heading: 'The four steps',
        steps: [
          'Property details — enter the facts. Only the title and location are required, but more detail gives better copy.',
          'Content settings — pick a main focus channel, a tone, a length, and optionally extra versions and formats.',
          'Generate — watch each piece of content being written live. You can stop at any time.',
          'Review & export — edit, refine with one click, then copy or download a PDF, Word or text file.',
        ],
      },
      {
        heading: 'What you get',
        paragraphs: [
          'Every run writes a listing description, a social post, an email and a video script. Everything is saved to your Library automatically, labelled with the engine that wrote it.',
        ],
        tips: ['Start with the Formal tone and Medium length — they suit most listings — then experiment.'],
      },
    ],
    related: ['property-details', 'reviewing-ai-output'],
  },
  {
    slug: 'property-details',
    title: 'Writing property details that sell',
    summary: 'The copy can only be as good as the facts you give it. Here’s how to write inputs that produce specific, persuasive listings.',
    minutes: 6,
    level: 'Writing',
    sections: [
      {
        heading: 'Be specific, not general',
        paragraphs: [
          'The model is instructed to use only the facts you provide. Vague inputs produce vague copy; concrete details give it something to work with.',
        ],
        example: {
          label: 'Features',
          bad: 'Great kitchen, nice outdoor area, close to everything',
          good: 'Stone-topped kitchen with SMEG appliances, north-facing paved courtyard, 400 m walk to Bridge Road trams',
        },
      },
      {
        heading: 'Order matters',
        paragraphs: [
          'Put the strongest selling point first in the Features field. It tends to lead the listing and the social post.',
        ],
        tips: ['Separate features with commas so each one reads as its own point.'],
      },
      {
        heading: 'Use agent notes for context buyers care about',
        paragraphs: [
          'Settlement terms, inspection times, rental history, vendor motivation — anything a buyer should know goes in Agent notes. It’s passed to the model as a fact like everything else.',
        ],
      },
      {
        heading: 'Leave out what you don’t know',
        paragraphs: [
          'If you don’t know the land size, leave it blank. The prompts tell the model to omit missing details rather than guess — but it can only omit what you haven’t filled in with a placeholder.',
        ],
        tips: ['Don’t type “TBC” or “approx.” into numeric fields; leave them empty instead.'],
      },
    ],
    related: ['tone-and-length', 'getting-started'],
  },
  {
    slug: 'tone-and-length',
    title: 'Choosing the right tone and length',
    summary: 'Six tones and four lengths, and when to use each — with the same property written different ways.',
    minutes: 4,
    level: 'Writing',
    sections: [
      {
        heading: 'Match the tone to the property and the buyer',
        steps: [
          'Formal — the safe default for most listings and portals.',
          'Friendly — warm and welcoming; good for family homes.',
          'Casual — relaxed and conversational; works best on social.',
          'Promotional — urgent, with a strong call to action; use for auctions and price drops.',
          'Luxury — refined and aspirational; reserve it for premium properties so it stays credible.',
          'Concise — straight to the facts; ideal for rentals and investors.',
        ],
      },
      {
        heading: 'Pick a length for the channel you care about most',
        paragraphs: [
          'Short keeps to the key facts. Medium is balanced. Long tells the full story. Extra long (400+ words) suits premium listings with a lot to say — it takes the AI noticeably longer to write.',
        ],
        tips: ['Tone applies to every channel at once. If you want the social post casual but the listing formal, run it twice.'],
      },
      {
        heading: 'Try versions before changing tone',
        paragraphs: [
          'Ask for two or three versions in Content settings. Seeing a few takes in the same tone is often quicker than switching tones back and forth.',
        ],
      },
    ],
    related: ['versions-and-formats', 'property-details'],
  },
  {
    slug: 'reviewing-ai-output',
    title: 'Reviewing AI output: a checklist',
    summary: 'Grounded prompts reduce invented details but can’t rule them out. Use this checklist before anything goes live.',
    minutes: 4,
    level: 'Writing',
    sections: [
      {
        heading: 'Why review matters',
        paragraphs: [
          'The model is given only your facts and told not to invent any. Even so, language models occasionally add details — a “master suite”, “views from the courtyard”, “walk to cafes” — that weren’t in your notes. Template copy can include general lifestyle lines too.',
        ],
      },
      {
        heading: 'The checklist',
        steps: [
          'Numbers: price, bedrooms, bathrooms, parking and sizes match your records exactly.',
          'Features: every feature mentioned is real, and none are exaggerated.',
          'Location claims: remove any distance, school, transport or view claim you can’t back up.',
          'Tone: it sounds like your agency, not a generic ad.',
          'Compliance: nothing breaches your local advertising rules (e.g. price representation).',
        ],
      },
      {
        heading: 'Check the engine label',
        paragraphs: [
          'Every result shows whether it was written by AI, partly by AI, or by templates. “Partly AI” means some channels timed out and were written from templates — give those a closer read.',
        ],
        tips: ['Use Edit & refine to fix details directly; refinements like “Shorten” keep your facts.'],
      },
    ],
    related: ['exporting', 'getting-started'],
  },
  {
    slug: 'versions-and-formats',
    title: 'Versions and extra formats',
    summary: 'Get up to three takes on each channel, plus headlines, a Facebook ad, an SMS, a flyer and SEO metadata — in one run.',
    minutes: 3,
    level: 'Workflow',
    sections: [
      {
        heading: 'Versions',
        steps: [
          'In Content settings, choose “Two versions” or “Three versions”.',
          'Generate. Each version streams in its own card.',
          'On the results screen, use the Versions switch on each channel to pick the one you like.',
          'Edit from there. The other versions stay saved in your Library.',
        ],
      },
      {
        heading: 'Extra formats',
        paragraphs: [
          'Tick any of: Headline options (five alternatives), Facebook ad, SMS / text blast (under 160 characters), Open-home flyer and SEO title & description. They’re written from the same facts and appear as extra tabs.',
        ],
        tips: ['Extra formats are included in Copy everything and in PDF, Word and text downloads.'],
      },
      {
        heading: 'Mind the time',
        paragraphs: [
          'Each version and format is another piece for the model to write. With the AI model, three versions plus all five extras is 17 pieces — expect a few minutes on a laptop.',
        ],
      },
    ],
    related: ['tone-and-length', 'batch'],
  },
  {
    slug: 'batch',
    title: 'Generating for many properties at once',
    summary: 'Use Batch to write content for up to 20 properties in one run — typed in or pasted from a spreadsheet.',
    minutes: 4,
    level: 'Workflow',
    sections: [
      {
        heading: 'Add your properties',
        steps: [
          'Open Batch from the sidebar.',
          'Type each property in, or use “Import from spreadsheet” and paste rows from Excel or Google Sheets.',
          'The first row must be headers. Recognised columns include title, location, price, bedrooms, bathrooms, parking, features and agent_notes.',
        ],
      },
      {
        heading: 'Run the batch',
        steps: [
          'Choose one focus, tone and length for the whole batch.',
          'Press Generate. Properties are written one after another, with live word counts.',
          'Stop at any time; finished properties are already saved. Retry any that failed.',
        ],
        tips: ['Open any finished property in the editor to review, refine and export it.'],
      },
    ],
    related: ['property-details', 'exporting'],
  },
  {
    slug: 'exporting',
    title: 'Exporting and publishing',
    summary: 'Copy a channel, copy everything, or download PDF, Word and text files — and where each works best.',
    minutes: 3,
    level: 'Workflow',
    sections: [
      {
        heading: 'Finalise first',
        paragraphs: [
          'Edits made in Edit & refine are included once you choose “Continue to export”. If you skip that, the Export screen offers to include your latest edits.',
        ],
      },
      {
        heading: 'Pick the right format',
        steps: [
          'Copy — paste a single channel straight into a portal, CRM or social scheduler.',
          'PDF — a formatted pack to send to a vendor or print.',
          'Word (DOCX) — for teams that finish copy in Word.',
          'Plain text — for systems that strip formatting.',
        ],
        tips: ['Everything you generate is also in the Library, so you can come back and export again later.'],
      },
    ],
    related: ['reviewing-ai-output'],
  },
  {
    slug: 'running-the-ai-model',
    title: 'Turning on the AI model',
    summary: 'For whoever runs the server: switch from template-only to live AI writing with Ollama, Colab or a local GPU.',
    minutes: 6,
    level: 'For admins',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'The server always builds a template version first as a safety net. When USE_LLM=true, it asks the configured model for every piece at the same time, streams the text to the browser as it’s written, and falls back to templates for anything that errors or runs past the time limit.',
        ],
      },
      {
        heading: 'Quickest option on a Mac: Ollama',
        steps: [
          'Install Ollama and download a model: `ollama pull mistral`.',
          'Start it: `ollama serve`.',
          'Start the backend with `USE_LLM=true LLM_BACKEND=ollama LLM_MODEL_NAME=mistral`.',
          'Generate — the results badge should read “AI · mistral”.',
        ],
      },
      {
        heading: 'Timeouts',
        paragraphs: [
          'LLM_TIMEOUT_SECONDS (default 15) limits the one-shot API per channel. The live streaming view uses LLM_STREAM_TIMEOUT_SECONDS (default 300) for the whole run. On a laptop, Ollama writes one piece at a time, so allow roughly 12–15 seconds per piece.',
        ],
        tips: ['Other options: LLM_BACKEND=remote_http with the Colab notebook in backend/ai_service, or local_transformers on a CUDA GPU.'],
      },
    ],
    related: ['reviewing-ai-output'],
  },
]

export const guideBySlug = (slug: string | undefined) => guides.find((g) => g.slug === slug)
