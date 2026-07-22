// Collapse any multi-column CSS grid to a single column on mobile while keeping
// the desktop template intact. Replaces the `isMobile ? '1fr' : '...'` ternaries
// scattered across pages.
//
// Mobile default is `minmax(0, 1fr)`, NOT `1fr`: a bare `1fr` track has an implicit
// minimum of `auto` (= min-content), so a child wider than the viewport (nested grid,
// long unbreakable text, a fixed-width inner row) forces the track — and the whole
// page — wider than the screen. `minmax(0, 1fr)` lets the track shrink below its
// content and clip/wrap instead, which is what we want on a phone. Identical to `1fr`
// whenever the content already fits.
//
// Usage: style={{ gridTemplateColumns: gridCols(isMobile, '1.2fr 1fr') }}
export function gridCols(isMobile: boolean, desktop: string, mobile: string = 'minmax(0, 1fr)'): string {
    return isMobile ? mobile : desktop;
}

export default gridCols;
