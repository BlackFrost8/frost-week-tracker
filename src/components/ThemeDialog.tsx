import { useEffect, useState } from 'react';
import { PRESETS } from '../lib/theme';
import { useTheme } from '../hooks/useTheme';

type Props = { open: boolean; onClose: () => void };

/** Primary as the field, accent as the mark on it — the same relationship the
    theme itself has, so the swatch previews the idea and not just two colours. */
function Swatch({ primary, accent, active }: { primary: string; accent: string; active: boolean }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform duration-150"
      style={{
        backgroundColor: primary,
        outline: active ? `1.5px solid ${accent}` : '1px solid rgba(var(--frost-far-rgb) / 0.14)',
        outlineOffset: active ? '2px' : '0px',
      }}
    >
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
    </span>
  );
}

export function ThemeDialog({ open, onClose }: Props) {
  const { presetId, spec, selectPreset, setCustom, reset } = useTheme();
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const colourField = (label: string, value: string, onChange: (hex: string) => void) => (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-frost-text-dim">{label}</span>
      <span className="flex items-center gap-3">
        <input
          value={value.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`);
          }}
          aria-label={`${label} hex value`}
          className="frost-field w-[8ch] text-right font-mono text-xs"
        />
        {/* The native picker: an OS-quality colour wheel for free, and the one
            control here that has to be a real input rather than our own. */}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-8 w-8 cursor-pointer rounded-lg bg-transparent p-0"
          style={{ border: '1px solid rgba(var(--frost-far-rgb) / 0.14)' }}
        />
      </span>
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Theme"
    >
      <div
        className="frost-rise w-full max-w-sm rounded-2xl p-7"
        style={{
          background:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), var(--color-frost-surface) 62%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg tracking-tight text-frost-text">Theme</h2>
        <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
          Changes everything at once, and stays on this device.
        </p>

        <div className="mt-6 flex flex-col gap-1">
          {PRESETS.map((preset) => {
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                aria-pressed={active}
                className="flex items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-[rgb(var(--frost-far-rgb)/0.04)]"
              >
                <Swatch primary={preset.spec.primary} accent={preset.spec.accent} active={active} />
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm"
                    style={{
                      color: active ? 'var(--color-frost-cyan-200)' : 'var(--color-frost-text)',
                    }}
                  >
                    {preset.name}
                  </span>
                  <span className="block truncate text-xs text-frost-text-faint">
                    {preset.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="mt-5 text-sm text-frost-text-dim transition-colors hover:text-frost-cyan-300"
        >
          {advanced ? 'hide advanced' : 'advanced — pick your own'}
        </button>

        {advanced && (
          <div className="mt-5 flex flex-col gap-4">
            {colourField('primary', spec.primary, (primary) => setCustom({ primary }))}
            {colourField('accent', spec.accent, (accent) => setCustom({ accent }))}
            <p className="text-xs leading-relaxed text-frost-text-faint">
              Surfaces, text tiers and the accent ramp are all derived from these two, so a light
              primary flips the whole app to dark text on its own.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
          style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: 'var(--frost-on-accent)' }}
        >
          done
        </button>
        {presetId !== 'frost' && (
          <button
            type="button"
            onClick={reset}
            className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
          >
            back to Frost
          </button>
        )}
      </div>
    </div>
  );
}
