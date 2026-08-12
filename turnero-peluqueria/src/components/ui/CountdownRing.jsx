import './CountdownRing.css';

const SIZE = 168;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CountdownRing({ label, progreso, urgente }) {
  const dashoffset = CIRC * (1 - progreso);

  return (
    <div className={`ring${urgente ? ' ring--urgente' : ''}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <pattern
            id="barberStripes"
            width="10"
            height="10"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="10" height="10" fill="var(--paper-dim)" />
            <rect width="5" height="10" fill="var(--line)" />
          </pattern>
        </defs>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="url(#barberStripes)"
          strokeWidth={STROKE}
        />
        <circle
          className="ring__progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="ring__center">
        <span className="ring__time">{label}</span>
        <span className="ring__sub">min restantes</span>
      </div>
    </div>
  );
}
