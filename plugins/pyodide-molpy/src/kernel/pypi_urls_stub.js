/**
 * Replaces `@jupyterlite/pyodide-kernel/lib/_pypi.js`.
 *
 * Upstream exports wheel files as ESM modules so webpack emits them under
 * `/static/assets/…`. Our runtime never uses those URLs — HostKernel passes
 * flat sibling URLs next to plugin.js (see `runtime_assets.ts`). Stub out the
 * module so the bundle does not emit or import binary .whl as JS.
 */
export const allJSONUrl = { default: "" };
export const pipliteWheelUrl = { default: "" };
export const ipykernelWheelUrl = { default: "" };
export const pyodide_kernelWheelUrl = { default: "" };
export const widgetsnbextensionWheelUrl = { default: "" };
export const widgetsnbextensionWheelUrl1 = { default: "" };
