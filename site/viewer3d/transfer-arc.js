import { toThree } from './frame.js';

// Inward nu runs π→0. Position angle is angleRad + (π - nu) so departure stays at angleRad.
export function hohmannArc(r1, r2, angleRad, steps) {
  const count = steps == null ? 64 : steps;
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const outward = r2 >= r1;
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = count === 0 ? 0 : i / count;
    const nu = outward ? Math.PI * t : Math.PI * (1 - t);
    const denom = 1 + e * Math.cos(nu);
    const r = a * (1 - e * e) / denom;
    const ang = outward ? angleRad + nu : angleRad + Math.PI - nu;
    points.push(toThree(r * Math.cos(ang), r * Math.sin(ang)));
  }
  return { a: a, e: e, r1: r1, r2: r2, points: points };
}
