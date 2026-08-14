import { useCallback, useState } from 'react';
import {
  DEFAULT_PRESET_ID,
  MAX_THEME_NAME,
  PRESETS,
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemeSpec,
} from '../lib/theme';

/**
 * The theme is already on the document by the time this runs — `main.tsx`
 * applies the stored one before React mounts, so there is no flash of the
 * default palette. This hook only owns *changing* it.
 */
export function useTheme() {
  const [stored, setStored] = useState(loadTheme);

  const commit = useCallback((presetId: string | null, name: string, spec: ThemeSpec) => {
    applyTheme(spec);
    const next = { presetId, name, spec };
    saveTheme(next);
    setStored(next);
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (preset) commit(preset.id, preset.name, preset.spec);
    },
    [commit],
  );

  /** Any edit to a colour drops the preset badge — it isn't that preset now.
      The name is kept, so renaming first and then tweaking a colour doesn't
      throw the name away. */
  const setCustom = useCallback(
    (patch: Partial<ThemeSpec>) => commit(null, stored.name, { ...stored.spec, ...patch }),
    [commit, stored.name, stored.spec],
  );

  /** Renaming alone doesn't make it a custom theme — you can rename a preset. */
  const setName = useCallback(
    (raw: string) => {
      const name = raw.slice(0, MAX_THEME_NAME);
      commit(stored.presetId, name, stored.spec);
    },
    [commit, stored.presetId, stored.spec],
  );

  const reset = useCallback(() => selectPreset(DEFAULT_PRESET_ID), [selectPreset]);

  return {
    presetId: stored.presetId,
    name: stored.name,
    spec: stored.spec,
    selectPreset,
    setCustom,
    setName,
    reset,
  };
}
