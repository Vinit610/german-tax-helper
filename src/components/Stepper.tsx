// Horizontal step indicator for the guided flow.

export interface Step {
  id: string;
  label: string;
}

interface Props {
  steps: Step[];
  current: string;
  onJump: (id: string) => void;
  /** Steps reachable so far (others are disabled). */
  reachable: Set<string>;
}

export function Stepper({ steps, current, onJump, reachable }: Props) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = step.id === current;
        const canJump = reachable.has(step.id);
        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onJump(step.id)}
              className={[
                'flex items-center gap-2 rounded-full px-3 py-1 font-medium transition',
                active
                  ? 'bg-brand-600 text-white'
                  : done
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-400',
                canJump && !active ? 'hover:bg-slate-100' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  active ? 'bg-white/20' : done ? 'bg-brand-100' : 'bg-slate-200',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </span>
              {step.label}
            </button>
            {i < steps.length - 1 && <span className="text-slate-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}
