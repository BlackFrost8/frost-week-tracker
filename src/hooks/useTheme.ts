import { useCallback, useState } from 'react';
import {
  DEFAULT_PRESET_ID,
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

  const commit = useCallback((presetId: string | null, spec: ThemeSpec) => {
    applyTheme(spec);
    const next = { presetId, spec };
    saveTheme(next);
    setStored(next);
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (preset) commit(preset.id, preset.spec);
    },
    [commit],
  );

  /** Any edit to a colour drops the preset badge — it isn't that preset now. */
  const setCustom = useCallback(
    (patch: Partial<ThemeSpec>) => commit(null, { ...stored.spec, ...patch }),
    [commit, stored.spec],
  );

  const reset = useCallback(() => selectPreset(DEFAULT_PRESET_ID), [selectPreset]);

  return { presetId: stored.presetId, spec: stored.spec, selectPreset, setCustom, reset };
}
