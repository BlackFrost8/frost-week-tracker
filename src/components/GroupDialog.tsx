import { useEffect, useRef, useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import { DEFAULT_ICON, searchIcons, type IconId } from '../lib/icons';
import { MAX_GROUP_NAME, type TaskGroup } from '../lib/prefs';
import { TaskIcon } from './TaskIcon';

type Props = {
  open: boolean;
  /** The group being edited, or null to make a new one. */
  group: TaskGroup | null;
  onClose: () => void;
  onSave: (name: string, icon: IconId) => void;
  onDelete?: () => void;
  /** How many tasks in the open week point here — said out loud before a delete. */
  taskCount?: number;
};

/**
 * Making a group: a name, and a mark from the library.
 *
 * Two fields and no colour picker. The mark is the entire visual identity,
 * because the palette is derived from the user's two theme colours at runtime
 * (`lib/theme.ts`) — a per-group colour would be the one thing on the page a
 * theme change couldn't reach, and it would spend the chroma budget (§6) on
 * decoration rather than on the things that report progress.
 */
export function GroupDialog({ open, group, onClose, onSave, onDelete, taskCount = 0 }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconId>(DEFAULT_ICON);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Seeded from the prop on every open rather than once at mount: the dialog
     is a single instance reused for "new" and for editing each group, so it is
     never remounted between them and initial state alone would show whichever
     group happened to be opened first. */
  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setIcon(group?.icon ?? DEFAULT_ICON);
    setQuery('');
    setConfirming(false);
  }, [open, group]);

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const panelRef = useDialog(open, onClose);

  if (!open) return null;

  const trimmed = name.trim();
  const results = searchIcons(query);

  const submit = () => {
    if (!trimmed) return;
    onSave(trimmed, icon);
    onClose();
  };

  /* Two-step, like `clear checks` — and for the same reason. Deleting a group
     is not destructive to any task (they simply stop being filed, see
     `groupById`), but it is invisible from here: the tasks that lose their
     mark are on six other days. */
  const remove = () => {
    if (!onDelete) return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    onDelete();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5"
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={group ? 'Edit group' : 'New group'}
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
        <h2 className="font-display text-lg tracking-tight text-frost-text">
          {group ? 'Edit group' : 'New group'}
        </h2>
        {/* The answer, at the size it will actually be read: this row is a
            literal preview of a task row, so choosing a mark is judged against
            the thing it has to work in rather than against a 40px swatch. */}
        <div className="mt-6 flex items-center gap-3">
          <span className="text-frost-cyan-300">
            <TaskIcon icon={icon} size={18} strokeWidth={1.9} />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            maxLength={MAX_GROUP_NAME}
            placeholder="School"
            aria-label="Group name"
            className="frost-field min-w-0 flex-1 text-lg leading-snug"
          />
        </div>

        <div className="mt-7">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs text-frost-cyan-500">mark</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search"
              aria-label="Search icons"
              className="frost-field w-[12ch] text-right text-xs"
            />
          </div>

          {/* Six across at any width the dialog can reach, so the grid never
              reflows into a ragged last row while you are scanning it. */}
          <div
            className="mt-3 grid max-h-[212px] grid-cols-6 gap-1 overflow-y-auto pr-0.5"
            role="radiogroup"
            aria-label="Icon"
          >
            {results.map((def) => {
              const active = def.id === icon;
              return (
                <button
                  key={def.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={def.label}
                  title={def.label}
                  onClick={() => setIcon(def.id)}
                  className="grid aspect-square place-items-center rounded-lg transition-colors duration-150"
                  style={{
                    color: active
                      ? 'var(--frost-on-accent)'
                      : 'var(--color-frost-text-dim)',
                    backgroundColor: active
                      ? 'var(--color-frost-cyan-200)'
                      : 'rgb(var(--frost-far-rgb) / 0.03)',
                  }}
                >
                  <TaskIcon icon={def.id} size={19} strokeWidth={1.7} />
                </button>
              );
            })}
          </div>

          {results.length === 0 && (
            <p className="mt-3 text-sm text-frost-text-faint">
              Nothing called “{query.trim()}”.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!trimmed}
          className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-opacity duration-150 disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: 'var(--frost-on-accent)' }}
        >
          {group ? 'save' : 'make group'}
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={remove}
            className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-alert"
          >
            {confirming
              ? taskCount > 0
                ? `delete — ${taskCount} task${taskCount === 1 ? '' : 's'} lose the mark?`
                : 'delete this group?'
              : 'delete group'}
          </button>
        )}
      </div>
    </div>
  );
}
