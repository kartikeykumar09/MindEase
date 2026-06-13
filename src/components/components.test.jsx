// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CheckIn from './CheckIn.jsx'
import SafetyCard from './SafetyCard.jsx'
import SupportCard from './SupportCard.jsx'
import ProviderToggle from './ProviderToggle.jsx'
import HistoryList from './HistoryList.jsx'
import { PROVIDERS } from '../lib/model.js'

afterEach(cleanup)

describe('CheckIn', () => {
  it('keeps Reflect disabled until both a mood and text are provided', async () => {
    const onReflect = vi.fn()
    render(<CheckIn onReflect={onReflect} busy={false} />)

    const reflect = screen.getByRole('button', { name: /reflect/i })
    expect(reflect).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /okay/i }))
    await userEvent.type(screen.getByLabelText(/what.+on your mind/i), 'feeling behind')
    expect(reflect).toBeEnabled()

    await userEvent.click(reflect)
    expect(onReflect).toHaveBeenCalledWith(3, 'feeling behind')
  })

  it('shows a busy label while reflecting', () => {
    render(<CheckIn onReflect={() => {}} busy={true} />)
    expect(screen.getByRole('button', { name: /reflecting/i })).toBeDisabled()
  })
})

describe('SafetyCard', () => {
  it('shows the hardcoded Tele-MANAS helpline as a tap-to-call link and no coping advice', () => {
    render(<SafetyCard onReset={() => {}} />)
    const call = screen.getByRole('link', { name: /14416/ })
    expect(call).toHaveAttribute('href', 'tel:14416')
    expect(screen.queryByText(/something you could try/i)).not.toBeInTheDocument()
  })

  it('is announced assertively to screen readers', () => {
    render(<SafetyCard onReset={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('SupportCard', () => {
  const analysis = {
    reflection: 'You sound stretched thin.',
    triggers: ['sleep', 'comparison'],
    coping: [{ title: 'Box breathing', how: 'In 4, out 6.' }],
    encouragement: 'You are doing your best.',
  }

  it('renders the reflection, triggers, coping and encouragement', () => {
    render(<SupportCard analysis={analysis} onReset={() => {}} />)
    expect(screen.getByText('You sound stretched thin.')).toBeInTheDocument()
    expect(screen.getByText('sleep')).toBeInTheDocument()
    expect(screen.getByText(/box breathing/i)).toBeInTheDocument()
    expect(screen.getByText(/doing your best/i)).toBeInTheDocument()
  })

  it('renders nothing when analysis is null', () => {
    const { container } = render(<SupportCard analysis={null} onReset={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('submits a companion follow-up when onFollowUp is provided', async () => {
    const onFollowUp = vi.fn()
    render(<SupportCard analysis={analysis} onFollowUp={onFollowUp} />)
    await userEvent.type(screen.getByLabelText(/want to say more/i), 'I keep procrastinating')
    await userEvent.click(screen.getByRole('button', { name: /continue talking/i }))
    expect(onFollowUp).toHaveBeenCalledWith('I keep procrastinating')
  })

  it('shows no follow-up form when onFollowUp is absent', () => {
    render(<SupportCard analysis={analysis} onReset={() => {}} />)
    expect(screen.queryByLabelText(/want to say more/i)).not.toBeInTheDocument()
  })
})

describe('CheckIn — accessibility + exam context', () => {
  it('explains via aria-describedby why Reflect is disabled', () => {
    render(<CheckIn onReflect={() => {}} busy={false} />)
    const reflect = screen.getByRole('button', { name: /^reflect$/i })
    expect(reflect).toBeDisabled()
    expect(reflect).toHaveAttribute('aria-describedby', 'reflect-hint')
    expect(screen.getByText(/pick a mood and write/i)).toBeInTheDocument()
  })

  it('renders the optional exam fields only when onExamChange is provided', () => {
    const { rerender } = render(<CheckIn onReflect={() => {}} busy={false} />)
    expect(screen.queryByLabelText(/^exam$/i)).not.toBeInTheDocument()

    rerender(<CheckIn onReflect={() => {}} busy={false} exam={null} onExamChange={() => {}} />)
    expect(screen.getByLabelText(/^exam$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument()
  })
})

describe('ProviderToggle', () => {
  it('disables the Gemini option when it is not configured', () => {
    render(
      <ProviderToggle provider={PROVIDERS.OLLAMA} onChange={() => {}} geminiAvailable={false} />,
    )
    expect(screen.getByRole('button', { name: /gemini/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /local/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('enables Gemini and reports the selected engine when available', async () => {
    const onChange = vi.fn()
    render(
      <ProviderToggle provider={PROVIDERS.OLLAMA} onChange={onChange} geminiAvailable={true} />,
    )
    const gemini = screen.getByRole('button', { name: /gemini/i })
    expect(gemini).toBeEnabled()
    await userEvent.click(gemini)
    expect(onChange).toHaveBeenCalledWith(PROVIDERS.GEMINI)
  })
})

describe('HistoryList — privacy controls', () => {
  const entries = [
    { id: 'a', ts: 1700000000000, mood: 3, text: 'felt okay today', analysis: null },
    { id: 'b', ts: 1700000100000, mood: 1, text: 'rough day', analysis: null },
  ]

  it('deletes a single entry via its delete button', async () => {
    const onDelete = vi.fn()
    render(<HistoryList entries={entries} onDelete={onDelete} onClearAll={() => {}} />)
    const deletes = screen.getAllByRole('button', { name: /delete check-in/i })
    expect(deletes).toHaveLength(2)
    await userEvent.click(deletes[0])
    expect(onDelete).toHaveBeenCalledWith('a')
  })

  it('requires confirmation before clearing all entries', async () => {
    const onClearAll = vi.fn()
    render(<HistoryList entries={entries} onDelete={() => {}} onClearAll={onClearAll} />)

    await userEvent.click(screen.getByRole('button', { name: /^clear all$/i }))
    // Not cleared yet — a confirm step appears first.
    expect(onClearAll).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /yes, clear all/i }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('cancelling the clear confirmation does nothing', async () => {
    const onClearAll = vi.fn()
    render(<HistoryList entries={entries} onDelete={() => {}} onClearAll={onClearAll} />)
    await userEvent.click(screen.getByRole('button', { name: /^clear all$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClearAll).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^clear all$/i })).toBeInTheDocument()
  })

  it('shows the empty state with no controls when there are no entries', () => {
    render(<HistoryList entries={[]} onDelete={() => {}} onClearAll={() => {}} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument()
  })
})
