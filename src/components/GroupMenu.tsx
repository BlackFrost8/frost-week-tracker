import { useEffect, useRef, useState } from 'react';
import { groupById, type TaskGroup } from '../lib/prefs';
import { TaskIcon } from './TaskIcon';

type Props = {
  groups: TaskGroup[];
  value: string | null;
  onSelect: (groupId: string | null) => void;
  /**
   * Offered as the last item. Omitted where a second dialog can't open on top
   * of the one already showing — see the standing-task editor.
   */
  onNewGroup?: () => void;
  /** What is being filed. Only ever read aloud, never shown. */
  subject: string;
  /**
   * Whether the trigger wears the current group's glyph or a plain tag.
   *
   * False where the row already shows the mark next to the label: one row
   * displaying the same icon twice reads as two separate facts about the task.
   * There the trigger is a verb — file this — and the mark is the answer.
   */
  showCurrent?: boolean;
  /** Extra classes for the trigger, so it can match the row it sits in. */
  className?: string;
  /** Glyph size on the trigger. The menu's own icons are fixed. */
  size?: number;
};

/**
 * The one control that puts a task in a group.
 *
 * It is a popover rather than an inline row of chips because assigning a group
 * is a rare act performed on a frequent object: every task row would otherwise
 * carry a permanent list of every group you own, which is a lot of furniture
 * for something you touch once per task.
 *
 * Where nothing else in the row reports the answer — a task being typed, a
 * standing task — the trigger wears the current group's glyph, so the state is
 * readable without opening anything. See `showCurrent`.
 */
export function GroupMenu({
  groups,
  value,
  onSelect,
  onNewGroup,
  subject,
  showCurrent = true,
  className = '',
  size = 13,
}: Props) {
  const [open, setOpen] = useState(false);
  /* Opening downward is the default; a row near the bottom of the viewport
     flips upward instead. Without it the menu on the last task of a long day
     opened into the fold, and there was nothing below it to scroll to. */
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = groupById(groups, value);

  useEffect(() => {
    if (!open) return;

    /* `pointerdown`, not `click`: a click listener fires after the mousedown
       has already blurred whatever was focused, so on the task row's edit
       field the input committed and unmounted the whole row — menu included —
       before the selection could land. */
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Stopped here so Escape closes the menu and not the dialog behind it.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      setUp(!!rect && window.innerHeight - rect.bottom < 280);
    }
    setOpen((v) => !v);
  };

  const choose = (groupId: string | null) => {
    onSelect(groupId);
    setOpen(false);
  };

  const item =
    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-[rgb(var(--frost-far-rgb)/0.05)]';

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={current ? `${subject} — in ${current.name}` : `${subject} — pick a group`}
        title={current ? current.name : 'Group'}
        className={`grid place-items-center rounded transition-colors duration-150 ${className}`}
        style={{
          color:
            (showCurrent && current) || open
              ? 'var(--color-frost-cyan-300)'
              : 'var(--color-frost-text-faint)',
        }}
      >
        <TaskIcon icon={showCurrent && current ? current.icon : 'tag'} size={size} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Group for ${subject}`}
          onClick={(e) => e.stopPropagation()}
          className={`frost-rise absolute right-0 z-40 flex w-[210px] flex-col gap-0.5 rounded-xl p-1.5 ${
            up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{
            backgroundColor: 'var(--color-frost-surface-2)',
            border: '1px solid var(--frost-hairline)',
            boxShadow: '0 12px 28px -12px rgb(var(--frost-base-rgb) / 0.9)',
          }}
        >
          {groups.length > 0 && (
            <div className="flex max-h-[228px] flex-col gap-0.5 overflow-y-auto">
              {groups.map((group) => {
                const active = group.id === value;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => choose(group.id)}
                    className={item}
                    style={{
                      color: active
                        ? 'var(--color-frost-cyan-200)'
                        : 'var(--color-frost-text)',
                    }}
                  >
                    <TaskIcon icon={group.icon} size={15} strokeWidth={1.9} />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Below the groups, not above them: picking a group is the common
              act and "none" is the undo. Hidden entirely when the task has no
              group, where it would be a no-op sitting above the real answers. */}
          {value !== null && (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(null)}
              className={`${item} text-frost-text-dim`}
            >
              <span className="grid h-[15px] w-[15px] place-items-center font-mono text-xs">
                —
              </span>
              no group
            </button>
          )}

          {onNewGroup && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNewGroup();
              }}
              className={`${item} text-frost-cyan-500`}
            >
              <span className="grid h-[15px] w-[15px] place-items-center font-mono">+</span>
              new group
            </button>
          )}

          {groups.length === 0 && !onNewGroup && (
            <p className="px-2.5 py-2 text-xs text-frost-text-faint">No groups yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
