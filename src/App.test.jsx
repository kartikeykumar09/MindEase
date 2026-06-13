// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the model + cloud provider so the flow is deterministic and offline. We keep the real
// PROVIDERS export from model.js and only stub the two network calls.
const { triage, analyze, geminiConfigured } = vi.hoisted(() => ({
  triage: vi.fn(),
  analyze: vi.fn(),
  geminiConfigured: vi.fn(),
}))
vi.mock('./lib/model.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, triage, analyze }
})
vi.mock('./lib/providers/gemini.js', () => ({ geminiConfigured, geminiChat: vi.fn() }))

import App from './App.jsx'
import { loadEntries } from './lib/storage.js'

/** Fill in mood + journal text and press Reflect. */
async function checkIn(text, moodLabel = /okay/i) {
  await userEvent.click(screen.getByRole('button', { name: moodLabel }))
  await userEvent.type(screen.getByLabelText(/what.+on your mind/i), text)
  await userEvent.click(screen.getByRole('button', { name: /^reflect$/i }))
}

beforeEach(() => {
  localStorage.clear()
  triage.mockReset()
  analyze.mockReset()
  geminiConfigured.mockResolvedValue(false)
})
afterEach(cleanup)

describe('App — safety-first check-in flow', () => {
  it('routes a crisis entry to the SafetyCard and never generates coping advice', async () => {
    triage.mockResolvedValue({ risk: 'crisis', reason: 'self-harm ideation' })
    render(<App />)
    await checkIn('I feel hopeless and want to disappear')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // Scope to the safety card itself — the footer also links the helpline.
    const safety = within(screen.getByRole('alert'))
    expect(safety.getByRole('link', { name: /14416/ })).toHaveAttribute('href', 'tel:14416')
    // PASS 2 must be skipped entirely on the crisis path.
    expect(analyze).not.toHaveBeenCalled()
    expect(screen.queryByText(/something you could try/i)).not.toBeInTheDocument()
  })

  it('treats elevated risk the same safe way (helpline only)', async () => {
    triage.mockResolvedValue({ risk: 'elevated', reason: 'panic' })
    render(<App />)
    await checkIn('I keep panicking and cannot cope')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(analyze).not.toHaveBeenCalled()
  })

  it('shows the SupportCard with reflection + coping when risk is none', async () => {
    triage.mockResolvedValue({ risk: 'none', reason: 'exam stress' })
    analyze.mockResolvedValue({
      reflection: 'It makes sense to feel stretched thin.',
      triggers: ['sleep', 'comparison'],
      coping: [{ title: 'Box breathing', how: 'In for 4, out for 6.' }],
      encouragement: 'Showing up takes real strength.',
    })
    render(<App />)
    await checkIn('So much syllabus left and everyone seems ahead')

    await waitFor(() => expect(screen.getByText(/stretched thin/i)).toBeInTheDocument())
    expect(screen.getByText(/box breathing/i)).toBeInTheDocument()
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('surfaces a recoverable error and still keeps the saved entry when the model is unreachable', async () => {
    triage.mockRejectedValue(new Error('connection refused'))
    render(<App />)
    await checkIn('just a normal day')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ollama/i))
    // The entry is persisted even though support generation failed.
    expect(loadEntries()).toHaveLength(1)
  })

  it('continues the conversation on a follow-up, re-running triage and stacking the thread', async () => {
    triage.mockResolvedValue({ risk: 'none', reason: 'ok' })
    analyze
      .mockResolvedValueOnce({
        reflection: 'First reflection.',
        triggers: [],
        coping: [],
        encouragement: '',
      })
      .mockResolvedValueOnce({
        reflection: 'A follow-up thought.',
        triggers: [],
        coping: [],
        encouragement: '',
      })
    render(<App />)
    await checkIn('exam stress')
    await waitFor(() => expect(screen.getByText('First reflection.')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/want to say more/i), 'tell me more')
    await userEvent.click(screen.getByRole('button', { name: /continue talking/i }))

    await waitFor(() => expect(screen.getByText('A follow-up thought.')).toBeInTheDocument())
    // The original turn stays on screen — it reads as a conversation.
    expect(screen.getByText('First reflection.')).toBeInTheDocument()
    // Safety triage ran again on the follow-up, and the prior reflection was passed as context.
    expect(triage).toHaveBeenCalledTimes(2)
    expect(analyze).toHaveBeenLastCalledWith(
      expect.any(Number),
      'tell me more',
      expect.any(String),
      expect.objectContaining({ priorReflection: 'First reflection.' }),
    )
  })

  it('a crisis follow-up switches to the SafetyCard', async () => {
    triage.mockResolvedValueOnce({ risk: 'none', reason: 'ok' })
    analyze.mockResolvedValue({
      reflection: 'First.',
      triggers: [],
      coping: [],
      encouragement: '',
    })
    render(<App />)
    await checkIn('ok day')
    await waitFor(() => expect(screen.getByText('First.')).toBeInTheDocument())

    triage.mockResolvedValueOnce({ risk: 'crisis', reason: 'self-harm' })
    await userEvent.type(screen.getByLabelText(/want to say more/i), 'I want to disappear')
    await userEvent.click(screen.getByRole('button', { name: /continue talking/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(
      within(screen.getByRole('alert')).getByRole('link', { name: /14416/ }),
    ).toBeInTheDocument()
  })
})
