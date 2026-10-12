import { Reveal } from '../components/motion/Reveal'
import { Accordion } from '../components/ui/Accordion'

const faqs = [
  {
    id: 'who',
    question: 'Who is REM Content Studio for?',
    answer: (
      <p>
        Agents, property managers and marketing coordinators who write the same property up for
        portals, social media, email and video — and want a consistent first draft in minutes.
      </p>
    ),
  },
  {
    id: 'ai',
    question: 'Does it use AI?',
    answer: (
      <>
        <p>
          Yes. Each channel is written by an open-source, instruction-tuned language model —
          Mistral 7B Instruct by default — using prompts built from your property details.
        </p>
        <p>
          If the model is slow or unavailable, the affected channels are written from templates
          instead. Every result is labelled AI, partly AI, or template fallback.
        </p>
      </>
    ),
  },
  {
    id: 'facts',
    question: 'Does it make things up?',
    answer: (
      <>
        <p>
          The model is given only the facts you enter and instructed never to invent a price,
          bedroom count, size, feature or location. Nothing is looked up online.
        </p>
        <p>
          That greatly reduces invented details but can't rule them out, and template copy can
          include general lines such as being close to schools. Read every draft before publishing.
        </p>
      </>
    ),
  },
  {
    id: 'time',
    question: 'How long does it take?',
    answer: (
      <p>
        You watch each piece being written live. How long it takes depends on the model server and
        how much you ask for — a single set of four channels typically takes under a minute. Anything
        the model doesn't finish in time is written from templates instead, and labelled.
      </p>
    ),
  },
  {
    id: 'edit',
    question: 'Can I edit the copy?',
    answer: (
      <p>
        Yes. Edit any channel directly, or use one-click refinements — improve tone, make it more
        persuasive, or shorten it — for one channel or all four at once.
      </p>
    ),
  },
  {
    id: 'storage',
    question: 'Where is my content kept?',
    answer: (
      <p>
        Each run is saved to the library in the app's database, where you can search, filter, reopen
        and delete it.
      </p>
    ),
  },
  {
    id: 'formats',
    question: 'Which formats can I export?',
    answer: <p>PDF, Word (.docx) and plain text (.txt). You can also copy one channel or all four.</p>,
  },
]

export function Faq() {
  return (
    <section id="faq" className="section-block" aria-labelledby="faq-title">
      <div className="site-container faq">
        <Reveal>
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-title" className="display section-title-xl">
            Questions agents ask.
          </h2>
        </Reveal>
        <Reveal>
          <Accordion items={faqs} />
        </Reveal>
      </div>
    </section>
  )
}
