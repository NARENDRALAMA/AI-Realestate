/** Short, contextual tips shown on each step (StepTips). Each links to a fuller guide. */
export type TipStep = 'property' | 'settings' | 'results' | 'edit' | 'export' | 'batch'

export const stepTips: Record<TipStep, { tips: string[]; guide: string; guideTitle: string }> = {
  property: {
    tips: [
      'Specific beats general: “stone-topped kitchen with SMEG appliances” beats “great kitchen”.',
      'Put the strongest feature first — it tends to lead the listing.',
      'Leave unknown fields empty rather than typing “TBC”.',
    ],
    guide: 'property-details',
    guideTitle: 'Writing property details that sell',
  },
  settings: {
    tips: [
      'Formal + Medium suits most listings. Try it first, then experiment.',
      'Two or three versions let you compare takes without changing tone.',
      'Every extra version or format adds writing time with the AI model.',
    ],
    guide: 'tone-and-length',
    guideTitle: 'Choosing the right tone and length',
  },
  results: {
    tips: [
      'Check every number and claim against your notes before publishing.',
      '“Partly AI” means some channels came from templates — read those closely.',
      'Asked for versions? Switch between them here, then edit your favourite.',
    ],
    guide: 'reviewing-ai-output',
    guideTitle: 'Reviewing AI output: a checklist',
  },
  edit: {
    tips: [
      'Refinements work per channel, or across all channels at once.',
      'Remove any location or distance claim you can’t back up.',
      'Your edits go to export when you press “Continue to export”.',
    ],
    guide: 'reviewing-ai-output',
    guideTitle: 'Reviewing AI output: a checklist',
  },
  export: {
    tips: [
      'Copy a single channel straight into a portal or scheduler.',
      'PDF suits vendors; Word suits teams who edit further.',
      'Everything stays in your Library, so you can export again later.',
    ],
    guide: 'exporting',
    guideTitle: 'Exporting and publishing',
  },
  batch: {
    tips: [
      'Paste rows straight from Excel or Google Sheets — include a header row.',
      'Properties are written one after another; finished ones are saved even if you stop.',
      'Open any finished property in the editor to review and export it.',
    ],
    guide: 'batch',
    guideTitle: 'Generating for many properties at once',
  },
}
