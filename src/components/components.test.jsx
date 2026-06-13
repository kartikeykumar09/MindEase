// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CheckIn from './CheckIn.jsx'
import SafetyCard from './SafetyCard.jsx'
import SupportCard from './SupportCard.jsx'
import ProviderToggle from './ProviderToggle.jsx'
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
