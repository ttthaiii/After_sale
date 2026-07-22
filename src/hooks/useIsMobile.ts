import { useEffect, useState } from 'react';

// Shared mobile-viewport hook. Single source of truth for the app's phone
// breakpoint (768px) so pages stop hand-rolling their own window.innerWidth
// listeners. Returns true while the viewport is narrower than `breakpoint`.
export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const update = () => setIsMobile(window.innerWidth < breakpoint);
        update();
        // addEventListener('change') is supported in all app-target browsers;
        // matchMedia keeps this cheaper than a raw resize listener.
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, [breakpoint]);

    return isMobile;
}

export default useIsMobile;
