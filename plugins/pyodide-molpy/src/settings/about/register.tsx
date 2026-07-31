import type { PluginAPI } from "../../types/plugin-api";

export function registerAboutSettings(api: PluginAPI): void {
  api.settings.registerSection({
    id: "about",
    title: "Pyodide · molpy",
    order: 80,
    render: () => (
      <div style={{ padding: 8, fontSize: 12, lineHeight: 1.5 }}>
        <p style={{ margin: "0 0 8px" }}>
          Browser Python via Pyodide. Notebook cells (plain text, no Monaco),
          Script library (Monaco only), and Console (xterm) share one kernel.
        </p>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Named scripts: <code>import molvis as mv; mv.run(&quot;camera.py&quot;)</code>
          {" "}or <code>stage.run(&quot;camera.py&quot;)</code>.{" "}
          <code>stage.camera.set_pose / fit_view / look_at</code> drive the
          live viewer via InProcess bridge.
        </p>
      </div>
    ),
  });
}
