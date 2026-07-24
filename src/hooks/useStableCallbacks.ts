import { useRef } from 'react';

// Wraps every function in `handlers` behind a stable-identity trampoline: the
// returned object's own function references never change across renders, but each
// one always calls through to the LATEST render's implementation (via a ref that's
// reassigned every render). This lets a Context's `value` object be safely wrapped
// in useMemo without manually re-deriving a useCallback dependency array for every
// mutator function — each wrapper can never go stale because it always dereferences
// the current render's closure at call time.
export function useStableCallbacks<T extends Record<string, (...args: any[]) => any>>(handlers: T): T {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    const stableRef = useRef<T | null>(null);
    if (!stableRef.current) {
        const stable = {} as T;
        for (const key of Object.keys(handlers) as (keyof T)[]) {
            stable[key] = ((...args: any[]) => handlersRef.current[key](...args)) as T[keyof T];
        }
        stableRef.current = stable;
    }
    return stableRef.current;
}
