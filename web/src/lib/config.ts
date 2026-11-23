// PoUW screens are opt-in, including in production demo builds.
export const showPouw = import.meta.env.VITE_SHOW_POUW === "true";
// Mock previews are development-only. A deployed bundle always reads Hasura,
// even if an inherited build environment accidentally enables VITE_USE_MOCKS.
export const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true";
