import { useEffect, useState } from 'react';
import { MAX_THEME_NAME, PRESETS } from '../lib/theme';
import { useDialog } from '../hooks/useDialog';
import type { useTheme } from '../hooks/useTheme';

/** The hook lives in App, not here: the wordmark in the header renders the
    theme's name, so both need the same instance of that state. */
type Props = { open: boolean; onClose: () => void; theme: ReturnType<typeof useTheme> };

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

/**
 * A colour as a hex box and a native picker.
 *
 * The text box keeps its own draft. It used to render the committed colour
 * directly while only committing on a complete six-digit value — which meant
 * every partial keystroke was rejected and React put the old colour straight
 * back. "#7", "#7C", "#7CF" are all invalid on the way to a valid one, so the
 * field could not be typed into at all; the picker was the only way in.
 *
 * The draft is what you see, the commit happens once the text means a colour,
 * and an abandoned half-edit is tidied up on blur.
 */
function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());

  // Follow the colour when it changes from somewhere else — a preset, or the
  // picker beside this box — but never clobber a draft that already means the
  // same colour, which is what an in-progress commit looks like.
  useEffect(() => {
    setDraft((d) =>
      d.trim().replace(/^#/, '').toLowerCase() === value.replace(/^#/, '').toLowerCase()
        ? d
        : value.toUpperCase(),
    );
  }, [value]);

  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-frost-text-dim">{label}</span>
      <span className="flex items-center gap-3">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = e.target.value.trim().replace(/^#/, '');
            if (/^[0-9a-fA-F]{6}$/.test(hex)) onChange(`#${hex}`);
          }}
          onBlur={() => setDraft(value.toUpperCase())}
          spellCheck={false}
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
}

export function ThemeDialog({ open, onClose, theme }: Props) {
  const { presetId, name, spec, selectPreset, setCustom, setName, reset } = theme;
  const [advanced, setAdvanced] = useState(false);

  // Escape, focus containment and focus restoration all live in the hook.
  const panelRef = useDialog(open, onClose);

  if (!open) return null;

  const colourField = (label: string, value: string, onChange: (hex: string) => void) => (
    <ColourField label={label} value={value} onChange={onChange} />
  );

  return (
    <div
      // `overflow-y-auto` + `my-auto` on the panel: with "advanced" open, or
      // with a phone keyboard covering half the screen while editing a hex
      // value, this dialog is taller than the viewport and "done" sat below
      // the fold with no way to reach it.
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5"
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Theme"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="frost-rise my-auto w-full max-w-sm rounded-2xl p-7 focus:outline-none"
        style={{
          background:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), var(--color-frost-surface) 62%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg tracking-tight text-frost-text">Theme</h2>

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

            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-frost-text-dim">name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_THEME_NAME}
                placeholder="Frost"
                aria-label="Theme name — becomes the wordmark"
                className="frost-field w-[14ch] text-right text-sm"
              />
            </label>

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
