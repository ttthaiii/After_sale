import type { CSSProperties } from 'react';

// Shrink a rem font-size on mobile by ONE shared ratio, so pages stop hand-picking
// a second magic number per heading. Pass an explicit `mobileOverride` only when a
// specific site must deviate from the default ratio. Non-rem sizes are returned
// unchanged. Companion to gridCols (responsiveGrid.ts) — same "one shared primitive
// instead of scattered isMobile ternaries" idea, for typography.
//
// Usage: style={{ fontSize: scaleFont(isMobile, '2.5rem') }}          // → 1.65rem on mobile
//        style={{ fontSize: scaleFont(isMobile, '2.5rem', '1.4rem') }} // explicit mobile size
export const MOBILE_FONT_RATIO = 0.66;

export function scaleFont(isMobile: boolean, desktop: string, mobileOverride?: string): string {
    if (!isMobile) return desktop;
    if (mobileOverride) return mobileOverride;
    const match = /^([\d.]+)rem$/.exec(desktop.trim());
    if (!match) return desktop; // not a plain rem value → leave untouched
    const scaled = Math.round(parseFloat(match[1]) * MOBILE_FONT_RATIO * 100) / 100;
    return `${scaled}rem`;
}

// ── T-010 type scale ────────────────────────────────────────────────────────
// Role-based font sizes from the mobile-first design spec. Unlike scaleFont's
// single 0.66 ratio, each role carries a hand-tuned mobile/desktop pair so
// headings, body, labels and codes shrink INDEPENDENTLY to what actually reads
// well at 375px — matching docs/mockups/*.html verbatim. Prefer ts() for any
// text whose size differs between phone and desktop; keep scaleFont for the
// existing rem-based consumers (back-compat, not deprecated).
export type TypeRole = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'code';

export const TYPE_SCALE: Record<TypeRole, { mobile: string; desktop: string }> = {
    display: { mobile: '28px', desktop: '40px' },
    h1:      { mobile: '20px', desktop: '32px' },
    h2:      { mobile: '16px', desktop: '22px' },
    h3:      { mobile: '15px', desktop: '18px' },
    body:    { mobile: '14px', desktop: '16px' },
    label:   { mobile: '12px', desktop: '13px' },
    code:    { mobile: '13px', desktop: '14px' },
};

// fontSize for a role at the current breakpoint.
// - On mobile: always the design's role token (the thing we're standardizing).
// - On desktop: `desktopOverride` if given, else the design's desktop token.
// RETROFIT an existing screen by passing its current desktop literal as
// `desktopOverride` — the desktop render then stays byte-identical (T-010
// "desktop untouched" invariant holds by construction), while the phone gets
// the design size. Omit `desktopOverride` for green-field code that wants the
// full design scale on both. Mirrors scaleFont's optional-override shape.
//   fontSize: ts(isMobile, 'h2', '1rem')   // 16px phone · '1rem' desktop (unchanged)
//   fontSize: ts(isMobile, 'display')      // 28px phone · 40px desktop (design)
export function ts(isMobile: boolean, role: TypeRole, desktopOverride?: string): string {
    if (isMobile) return TYPE_SCALE[role].mobile;
    return desktopOverride ?? TYPE_SCALE[role].desktop;
}

// Identifier codes (work-order numbers, SKUs, doc refs) must stay on ONE line —
// a wrapped code reads as two separate values. Monospace + nowrap; pair with
// ts(isMobile, 'code'). Spread into a style: style={{ ...identifierStyle }}.
export const identifierStyle: CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    whiteSpace: 'nowrap',
};

export default scaleFont;
