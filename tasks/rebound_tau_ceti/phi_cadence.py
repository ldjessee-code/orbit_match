"""High-cadence sample of the isolated doc moons, to resolve phi2.

Same initial conditions as C_isolated. 200 years is long enough to see
whether phi2 librates or circulates, and short enough to finish quickly.
"""

import math

import numpy as np
import rebound

import tau_ceti_model as model

YEARS = 200.0
STEP = 0.01


def main():
    sim, _meta = model.build_moons(phase="resonant", isolated=True)
    sim.integrator = "ias15"
    sim.integrator.epsilon = 1e-9
    phi1 = []
    phi2 = []
    while sim.t < YEARS:
        sim.integrate(min(sim.t + STEP, YEARS), exact_finish_time=0)
        sim.synchronize()
        a, b = model.resonant_angles(sim)
        phi1.append(a)
        phi2.append(b)
    p1 = np.asarray(phi1)
    p2 = np.asarray(phi2)
    for name, phi in (("phi1", p1), ("phi2", p2)):
        z = np.mean(np.exp(1j * phi))
        unw = np.unwrap(phi)
        print(
            f"{name} min_deg {math.degrees(phi.min()):.2f} max_deg {math.degrees(phi.max()):.2f} "
            f"center {math.degrees(math.atan2(z.imag, z.real)):.2f} conc {abs(z):.4f} "
            f"unwrap_net_deg {math.degrees(float(unw[-1]-unw[0])):.1f} "
            f"max_step_deg {math.degrees(float(np.max(np.abs(np.diff(unw))))):.2f}"
        )


if __name__ == "__main__":
    main()
