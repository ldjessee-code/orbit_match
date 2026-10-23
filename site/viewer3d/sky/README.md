# Tau Ceti skybox (r1, 2026-10-20) - status: DONE

Requester: Owner notDoug (via Sean). Built by Rudy, Blender 5.2.2 LTS headless on PC-NorCal, court-run `rudy-tauceti-skybox-r1_20261020_092422` (PASS, 12 s).
Method: Blender Python numpy splat (no Cycles, exact per-pixel angular Gaussian PSF); images written by Blender `save_render`.

## Input
`/TheCourt/research/_jobs/star-catalog/starview_20261020/tau_ceti_sky_mag6.5.csv` (9,397 rows, ICRS equatorial unit vectors, origin Tau Ceti). Copy in `in\`.
Dropped (probable Capella component double-count): `hyg:118360 Gl 194B` app_mag 0.921, 0.17 deg from Capella. Kept 9,396 stars. Sol = `hyg:0`, mag 2.64.

## Frame / mapping (three.js, y-up)
three = (ux, uz, -uy)  -> +Y = north celestial pole (ICRS +z), +X = RA 0h, -Z = RA 6h.
- Equirect (`scene.background` with `EquirectangularReflectionMapping`, flipY default): u = atan2(three.z, three.x)/2pi + 0.5, v = asin(three.y)/pi + 0.5; image top row = v=1 (NCP). Column x = u*W, row-from-top y = (1-v)*H. (RA = atan2(uy,ux) = atan2(-three.z, three.x)).
- Cubemap (`CubeTextureLoader().setPath('cube/').load(['px.png','nx.png','py.png','ny.png','pz.png','nz.png'])`): three.js samples background CubeTextures at (-x, y, z) (flipEnvMap = -1). Faces are therefore baked with standard GL face orientation applied to g = (-three.x, three.y, three.z). Do NOT pass these faces through an extra mirror.
No orbital-plane / pole rotation applied; apply any system inclination as a rotation of the background (scene.backgroundRotation).

## Brightness
flux = 10^(-0.4*(m - 6.5)); energy = 0.24*flux (linear units, mag 6.5 peak ~0.15).
Core Gaussian radius R px (at 8K-equirect / 2048-cube pixel angle 2pi/8192): R = 1 + 3*(sqrt(flux)-1)/(sqrt(flux(-1))-1), capped 4 (mag -1); sigma = R/2, plus 1/12 px^2 box term for sub-pixel AA.
Halo only for m < 2: second Gaussian sigma = 3R, 4% of the star's energy. No spikes. Black background, no Milky Way.
Color: CSV linear RGB, saturation x1.3 around Rec.709 luminance, max-normalized.
EXR: linear, half float, unclipped (peaks ~10-12). PNGs: display = sRGB(1 - exp(-linear)); 4K PNG is a 2x2 box downsample of the 8K master with x2 gain to keep faint points visible.

## Outputs (`out\`)
- tauceti_sky_equirect_8k.exr - 8192x4096 half-float master
- tauceti_sky_equirect_4k.png - 4096x2048 8-bit sRGB
- cube\px.png nx py ny pz nz - 2048x2048 8-bit sRGB
- verify.json - spot checks

## Verification (8K equirect peak vs expected, px)
- Sirius (m -0.66, RA 165.6 Dec +3.7): expected (327.5, 1963.7) peak (327.5, 1963.5), cube face px. Canopus (m -0.65, RA 99.4 Dec -52.9): expected (1835.3, 3250.9) peak (1835.5, 3250.5), face ny. Capella expected (1797.3, 816.5) peak (1797.5, 816.5), cube face py; Sol expected (7600.1, 1685.4) peak (7600.5, 1685.5), RA 206.0 Dec +15.9 (= antipode of Tau Ceti as seen from Sol, correct), cube face px.
