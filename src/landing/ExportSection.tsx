import { Copy, FileText, FileType2, type LucideIcon } from 'lucide-react'
import { BrowserFrame } from '../components/media/Media'
import { Reveal, Stagger, StaggerItem } from '../components/motion/Reveal'

const formats: { icon: LucideIcon; name: string; ext: string; body: string }[] = [
  { icon: FileText, name: 'PDF', ext: '.pdf', body: 'A formatted document with all four channels, ready to send to a vendor or print.' },
  { icon: FileType2, name: 'Word', ext: '.docx', body: 'An editable document for teams that finish copy in Microsoft Word.' },
  { icon: FileText, name: 'Plain text', ext: '.txt', body: 'Clean text to paste into a listing portal, CRM or social scheduler.' },
  { icon: Copy, name: 'Clipboard', ext: 'copy', body: 'Copy a single channel, or every channel at once, with one click.' },
]

export function ExportSection() {
  return (
    <section id="export" className="section-block" aria-labelledby="export-title">
      <div className="site-container export-grid">
        <div>
          <Reveal>
            <p className="eyebrow">Export</p>
            <h2 id="export-title" className="display section-title-xl">
              Take it wherever your listing goes.
            </h2>
          </Reveal>
          <Stagger as="ul" className="formats">
            {formats.map(({ icon: Icon, name, ext, body }) => (
              <StaggerItem as="li" key={name} className="format">
                <span className="format__icon" aria-hidden>
                  <Icon />
                </span>
                <div>
                  <h3 className="format__name">
                    {name} <span className="format__ext">{ext}</span>
                  </h3>
                  <p className="format__body">{body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Reveal>
          <BrowserFrame screen="export" sizes="(min-width: 64rem) 560px, 100vw" caption="The export screen in the app" />
        </Reveal>
      </div>
    </section>
  )
}
