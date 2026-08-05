/**
 * Default notebook demo — caffeine showcase (3 cells).
 *
 * 1. Load + draw via stage.draw (bond_type / Kekulé path)
 * 2. Slow infinite camera orbit
 * 3. %%mv.demo representation style tour
 *
 * Cross-cell names must stay public (frame, stage) — kernel drops ``_x``.
 */

export const DEMO_CAFFEINE_BUILD = `\
import molpy as mp
import molvis as mv

stage = mv.Stage()
frame = mp.io.SmilesReader("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").read()
stage.clear()
stage.draw(frame)
stage.camera.fit()
`;

export const DEMO_CAFFEINE_ORBIT = `\
import numpy as np

pose = stage.camera.pose
t = np.asarray(pose.target, dtype=float)
r = float(pose.radius)
keys = [
    (t[0] + r, t[1],     t[2] + 0.30 * r),
    (t[0],     t[1] + r, t[2] + 0.30 * r),
    (t[0] - r, t[1],     t[2] + 0.30 * r),
    (t[0],     t[1] - r, t[2] + 0.30 * r),
    (t[0] + r, t[1],     t[2] + 0.30 * r),
]
stage.camera.track(keys, target=t, duration=np.inf, rate=0.5)
`;

export const DEMO_CAFFEINE_STYLES = `\
%%mv.demo delay=1.0
for theme in stage.THEME:
    for style in stage.STYLE:
        stage.set_style(style, theme)
`;
