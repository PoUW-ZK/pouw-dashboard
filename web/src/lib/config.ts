// PoUW screens are opt-in, including in production demo builds.
export const showPouw = import.meta.env.VITE_SHOW_POUW === "true";
export const useMocks = import.meta.env.VITE_USE_MOCKS === "true";
