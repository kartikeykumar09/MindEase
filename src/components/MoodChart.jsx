/**
 * A dependency-free SVG line chart of mood over time. Accessible: includes a text summary
 * and a data table fallback for screen readers.
 * @param {{ series: {ts: number, mood: number}[] }} props
 * @returns {JSX.Element}
 */
export default function MoodChart({ series }) {
  if (!series || series.length === 0) {
    return <p className="muted">No mood data yet — check in a few times to see your trend.</p>
  }

  const W = 600
  const H = 220
  const PAD = 36
  const n = series.length
  const xFor = (i) => (n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1))
  const yFor = (mood) => H - PAD - ((mood - 1) / 4) * (H - 2 * PAD)

  const points = series.map((p, i) => `${xFor(i)},${yFor(p.mood)}`).join(' ')

  /** @param {number} ts */
  const fmt = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Mood over your last ${n} check-ins, on a scale of 1 to 5.`}
        style={{ maxWidth: '100%' }}
      >
        {/* gridlines for moods 1-5 */}
        {[1, 2, 3, 4, 5].map((m) => (
          <g key={m}>
            <line x1={PAD} y1={yFor(m)} x2={W - PAD} y2={yFor(m)} stroke="#e3edf7" strokeWidth="1" />
            <text x={PAD - 8} y={yFor(m) + 4} fontSize="12" textAnchor="end" fill="#45546e">
              {m}
            </text>
          </g>
        ))}
        {n > 1 && (
          <polyline fill="none" stroke="#3a6ea5" strokeWidth="3" points={points} strokeLinejoin="round" />
        )}
        {series.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.mood)} r="5" fill="#3a6ea5" />
        ))}
        {/* first + last date labels */}
        <text x={xFor(0)} y={H - 8} fontSize="12" textAnchor="middle" fill="#45546e">
          {fmt(series[0].ts)}
        </text>
        {n > 1 && (
          <text x={xFor(n - 1)} y={H - 8} fontSize="12" textAnchor="middle" fill="#45546e">
            {fmt(series[n - 1].ts)}
          </text>
        )}
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>Mood by check-in</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mood (1-5)</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p, i) => (
              <tr key={i}>
                <td>{new Date(p.ts).toLocaleString()}</td>
                <td>{p.mood}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}
