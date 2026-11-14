import type { Transition, Variants } from 'motion/react';

export const FAST_TRANSITION: Transition = {
  duration: 0.2,
  ease: 'easeOut',
};

export const PAGE_TRANSITION_PROPS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
};

export const HERO_CHAT_VARIANTS: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: 'easeOut' },
  },
};

export const SECTION_REVEAL_VARIANTS: Variants = {
  initial: { opacity: 0, y: 12 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

export const STAGGER_CONTAINER_VARIANTS: Variants = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const STAGGER_ITEM_VARIANTS: Variants = {
  initial: { opacity: 0, y: 10 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: 'easeOut' },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: FAST_TRANSITION,
  },
};
