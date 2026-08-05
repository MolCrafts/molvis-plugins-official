/**
 * Default notebook demo — caffeine showcase (3 cells).
 *
 * 1. Load + draw_frame + commit (edit pool → HEAD)
 * 2. Slow infinite camera orbit
 * 3. %%mv.demo: style tour, then theme tour (set_style outside theme loop)
 *
 * Cross-cell names must stay public (frame, stage) — kernel drops ``_x``.
 */

export const DEMO_CAFFEINE_BUILD = `\
import molpy as mp
import molvis as mv

stage = mv.Stage()
frame = mp.io.SmilesReader("CN1C=NC2=C1C(=O)N(C(=O)N2C)C").read()
stage.clear()
stage.draw_frame(frame)
stage.commit()
stage.camera.fit()
print("caffeine:", frame)
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
print("orbiting… interrupt to stop")
`;

export const DEMO_CAFFEINE_STYLES = `\
%%mv.demo delay=0.5
for style in stage.STYLE:
    print("style:", style)
    stage.set_style(style)
for theme in stage.THEME:
    print("theme:", theme)
    stage.set_theme(theme)
`;
