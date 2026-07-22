import type { CSSProperties } from 'react';

// Layout primitives for the T-010 mobile-first redesign. Companion to
// responsiveText.ts (typography) and responsiveGrid.ts (grid collapse) — small
// shared style objects so pages stop re-declaring the same mobile fixes inline.

// A row of chips / pills / filter tabs that would wrap into many lines on a
// phone. Scroll it horizontally instead: flex-nowrap + x-scroll, momentum scroll
// on iOS, scrollbar hidden (it is a touch surface). Desktop is unaffected — a row
// that already fits simply never scrolls. Pair with a "swipe ←→" hint on dense
// rows where discoverability matters.
export const chipScrollRow: CSSProperties = {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 8,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
};

export default chipScrollRow;
