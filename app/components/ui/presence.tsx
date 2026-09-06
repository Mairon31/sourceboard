import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { getMotionTransition, motionRecipes } from "../../../shared/design/motion";

export interface PresencePanelProps {
  show: boolean;
  children: ReactNode;
  className?: string;
}

export function PresencePanel({ show, children, className }: PresencePanelProps) {
  const reducedMotion = useReducedMotion();
  const reduced = Boolean(reducedMotion);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          className={className}
          initial={reduced ? false : motionRecipes.panel.initial}
          animate={motionRecipes.panel.animate}
          exit={reduced ? motionRecipes.overlay.exit : motionRecipes.panel.exit}
          transition={getMotionTransition(reduced)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
