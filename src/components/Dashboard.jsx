import MoodChart from './MoodChart.jsx'
import { aggregateTriggers, moodSeries } from '../lib/triggers.js'

/**
 * Patterns over time: a mood line chart and a ranked list of recurring stress triggers.
 * @param {{ entries: import('../lib/storage.js').Entry[] }} props
 * @returns {JSX.Element}
 */
export default function Dashboard({ entries }) {
  const series = moodSeries(entries)
  const triggers = aggregateTriggers(entries)
  const max = triggers.length ? triggers[0].count : 1

  return (
    <section aria-labelledby="dash-title">
      <h2 id="dash-title">Your patterns</h2>

      <div className="card">
        <h3>Mood over time</h3>
        <MoodChart series={series} />
      </div>

      <div className="card">
        <h3>Recurring triggers</h3>
        {triggers.length === 0 ? (
          <p className="muted">
            No triggers detected yet. They&apos;ll appear as you reflect on more entries.
          </p>
        ) : (
          <ul className="stat-list" aria-label="Recurring triggers by frequency">
            {triggers.map(({ tag, count }) => (
              <li key={tag}>
                <span className="tag-name">{tag}</span>
                <span
                  className="bar"
                  style={{ width: `${(count / max) * 60}%` }}
                  aria-hidden="true"
                />
                <span className="muted">{count}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
