// Shared motion vocabulary. Seconds, never frame counts. Original implementation.
export const MOTION = Object.freeze({ follow: .16, pointer: .25, rotation: .052, reveal: .7, companySpeed: 52, storyDuration: 16 });
export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export const damp = (value, target, seconds, dt) => target + (value - target) * Math.exp(-Math.max(0, dt) / seconds);
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const phaseWeights = progress => Array.from({ length: 4 }, (_, i) => 1 - smooth((Math.abs(clamp(progress) * 3 - i) - .35) / .3));
// Three source selections, then a longer hold on the complete draft.
export const emailPhase = seconds => Math.min(3, Math.floor(((Math.max(0, seconds) % MOTION.storyDuration) + 1e-8) / 3.2));
