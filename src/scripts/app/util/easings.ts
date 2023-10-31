// ease in/out/in-out mathematical helper functions
// source: https://easings.net

// ease in-out
export function easeInOutSine(x: number) { return -(Math.cos(Math.PI * x) - 1) / 2; }
export function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
export function easeInOutCirc(x: number) {
  return x < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
}

// ease out
export function easeOutCirc(x: number) { return Math.sqrt(1 - Math.pow(x - 1, 2)); }
export function easeOutSine(x: number) { return Math.sin((x * Math.PI) / 2); }
export function easeOutQuint(x: number) { return 1 - Math.pow(1 - x, 5); }
export function easeOutQuart(x: number) { return 1 - Math.pow(1 - x, 4); }
export function easeOutCubic(x: number) { return 1 - Math.pow(1 - x, 3); }
export function easeOutQuad(x: number) { return 1 - (1 - x) * (1 - x); }

export function easeOutQuintInverse(y: number) { return 1 - Math.pow(1 - y, 1 / 5); }

// trivial functions
export function easeLinear(x: number) { return x; }
export function easeInstant(x: number) { return 0 * x + 1; }
