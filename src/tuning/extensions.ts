// Phase 5B (docs/plans/phase-5b-framework.md S4): per S1, no real
// extensions ship in 5B — Amplifier/Twin Barrel/Blade Count and the rest
// of the catalogue's per-weapon extensions are Phase 6 content. This one
// placeholder proves the leveling-and-removal mechanism (an extension
// picked at level 3 leaves the card pool permanently, per the owner's
// rule) without authoring 18 weapons' worth of real mechanics that would
// only be thrown away when 6B lands. Every weapon offers the same
// placeholder, honestly labelled as one, rather than a fabricated
// per-weapon mechanic.
export const PLACEHOLDER_EXTENSION_KIND = 'placeholder';
export const PLACEHOLDER_EXTENSION_MAX_LEVEL = 3;
export const PLACEHOLDER_EXTENSION_NAME = 'Prototype Mount';
export const PLACEHOLDER_EXTENSION_DESC = (lvl: number): string =>
  `Placeholder extension slot — Phase 6 replaces this with real per-weapon content. Lv${lvl}/${PLACEHOLDER_EXTENSION_MAX_LEVEL}.`;
