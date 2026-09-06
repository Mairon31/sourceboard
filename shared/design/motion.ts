export const motionRecipes = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  panel: {
    initial: { opacity: 0, y: 8, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.99 },
  },
} as const;

export function getMotionTransition(reduced: boolean, duration = 0.22) {
  if (reduced) return { duration: 0 } as const;

  return {
    duration,
    ease: [0.2, 0.8, 0.2, 1] as const,
  };
}
