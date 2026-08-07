// Phase 4B (Decisions 66/67): the two-axis visual system. Density and
// maturity are two genuinely independent perceptual dimensions rather than
// one hand-picked hex list per bucket — §6 of
// docs/sessions/2026-08-05-slime-and-arsenal-rework.md's "5 density steps x
// 4 maturity steps = 20 states, none hand-authored." The two channels must
// stay strictly separated: thickness means only mass, colour means only
// hardness. See docs/plans/phase-4b-two-axis-visuals.md.

// Density bucket (cellBucket's 0-5) -> alpha. On a black background, alpha
// *is* thickness. Even spacing is the actual fix for the old palette's
// "5 buckets read as 3" collapse bug — the defect was the *unevenness* of
// the old hex steps, not the hues, so an evenly-stepped channel can't
// collapse the same way regardless of what colour rides on top. Index 0 is
// unrendered (no slime).
export const DENSITY_ALPHA: readonly number[] = [0, 0.25, 0.45, 0.65, 0.83, 1.0];

// Maturity bucket -> hue/saturation, a "drying and hardening" ramp from wet
// slime to bone. RGB component strings (not hex) so they compose directly
// into an rgba() fillStyle with a per-cell alpha.
//
// Calcified is pale, not the design record's "dark, desaturated" (Decision
// 66 — a deliberate supersession, project owner's call, 2026-08-07). Dark
// scarring reproduces the exact bug the Phase 4A placeholder shipped with:
// scarring concentrates on *cleared* ground, and dark-on-cleared (black) is
// exactly as invisible as the placeholder's dark overlay was — measured at
// the time, 64% of all scarred cells sat on bucket-0 (black) ground.
export const MATURITY_COLORS: readonly string[] = [
  '255,63,104', // 0 — fresh: hot pink, wet. The existing slime identity, preserved.
  '232,128,111', // 1 — coral, warming
  '216,180,154', // 2 — clay, desaturating
  '240,232,220', // 3 — calcified: bone
];

// Bare scarred ground (density bucket 0, maturity > 0) — alpha per maturity
// bucket. Always strictly below DENSITY_ALPHA[1] (0.25, the thinnest slime
// alpha) so terrain can never read as "more" than actual tissue; it's
// ground, not growth. This is what makes §7's tree rings legible on
// cleared ground and replaces the Phase 4A neon-green placeholder.
export const BARE_SCAR_ALPHA: readonly number[] = [0, 0.1, 0.16, 0.22];

// Frost's freeze state — a rim, not a fill, so it can never compete with
// the two axes above. Shares Frost Nova's own ring colour (Decision 66),
// so the visual language already exists in the game rather than
// introducing a fourth unrelated one.
export const FROZEN_RIM_COLOR = '#bfe9ff';
