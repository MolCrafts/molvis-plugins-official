import{jsx as e,jsxs as t}from"react/jsx-runtime";import{useCallback as r,useEffect as i,useRef as s,useState as o,useSyncExternalStore as n}from"react";var a={};a.d=(e,t,r)=>{var i=(t,r)=>{for(var i in t)a.o(t,i)&&!a.o(e,i)&&Object.defineProperty(e,i,{enumerable:!0,[r]:t[i]})};i(t,"get"),i(r,"value")},a.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);var l={};function d(e){let t=e.getTarget();return{alpha:e.alpha,beta:e.beta,radius:e.radius,target:[t.x,t.y,t.z],position:[e.position.x,e.position.y,e.position.z],up:[e.upVector.x,e.upVector.y,e.upVector.z]}}function c(e){try{e.world.renderOnce?.()}catch{}}function u(e){return{call(t){let r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!e)throw Error("molvis app is not available");let i=e.world.camera;if(!i)throw Error("world.camera is not available");switch(t){case"camera.get_pose":return d(i);case"camera.set_pose":if("number"==typeof r.alpha&&(i.alpha=r.alpha),"number"==typeof r.beta&&(i.beta=r.beta),"number"==typeof r.radius&&(i.radius=Math.max(.01,r.radius)),Array.isArray(r.target)&&r.target.length>=3){let e=r.target;i.setTarget({x:e[0],y:e[1],z:e[2]})}return i.rebuildAnglesAndRadius?.(),c(e),{pose:d(i)};case"camera.look_at":{let t=r.position,s=r.target;if(!t||!s||t.length<3||s.length<3)throw Error("look_at requires position and target length-3 arrays");if(Array.isArray(r.up)&&r.up.length>=3){let e=r.up;i.upVector={x:e[0],y:e[1],z:e[2]}}return i.setTarget({x:s[0],y:s[1],z:s[2]}),i.setPosition?i.setPosition({x:t[0],y:t[1],z:t[2]}):(i.position.x=t[0],i.position.y=t[1],i.position.z=t[2]),i.rebuildAnglesAndRadius?.(),c(e),{pose:d(i)}}case"camera.fit_view":return e.world.resetCamera?e.world.resetCamera({viewDirection:"iso"}):e.resetCamera?.(),c(e),{pose:d(i)};default:throw Error(`unknown bridge method: ${t}`)}}}}a.d(l,{A:()=>ee,n:()=>Z});let p="https://cdn.jsdelivr.net/pyodide/v314.0.3/full/";async function m(){let e=`${p}pyodide.mjs`;return(0,(await import(e)).loadPyodide)({indexURL:p})}let y=`
import sys
import types
import math
# Script library map: name -> source (synced from JS)
_MOLVIS_SCRIPTS = dict(globals().get("_MOLVIS_SCRIPTS") or {})

# Host bridge registered as JS module "molvis_host"
from molvis_host import call as _host_call

def _bridge(method, params=None):
    p = params or {}
    # pyodide: plain dict → JS object
    return _host_call(method, p)

class Camera:
    """Camera control — InProcess RPC to the live viewer."""
    def __init__(self, stage):
        self._stage = stage

    def get_pose(self):
        return _bridge("camera.get_pose", {})

    def set_pose(self, *, alpha=None, beta=None, radius=None, target=None):
        params = {}
        if alpha is not None:
            params["alpha"] = float(alpha)
        if beta is not None:
            params["beta"] = float(beta)
        if radius is not None:
            params["radius"] = float(radius)
        if target is not None:
            params["target"] = [float(v) for v in target]
        result = _bridge("camera.set_pose", params)
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

    def fit(self):
        """Alias for fit_view (molpy-style short name)."""
        return self.fit_view()

    def fit_view(self):
        result = _bridge("camera.fit_view", {})
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

    def look_at(self, position, target, up=None):
        params = {
            "position": [float(v) for v in position],
            "target": [float(v) for v in target],
        }
        if up is not None:
            params["up"] = [float(v) for v in up]
        result = _bridge("camera.look_at", params)
        return result.get("pose") if hasattr(result, "get") else getattr(result, "pose", result)

class Stage:
    """Browser Stage — same public name as CPython mv.Stage."""
    def __init__(self, name="default"):
        self.name = name
        self._camera = Camera(self)
        self._mode = "python"

    def draw(self, obj):
        # Full Frame draw needs molpy + binary path; keep explicit for now.
        print("[stage.draw] not yet bridged — use host file open / CPython Stage")
        return self

    @property
    def camera(self):
        return self._camera

    @property
    def mode(self):
        return self._mode

    @property
    def selection(self):
        return _SelectionStub()

    def run(self, script):
        return run(script)

class _SelectionStub:
    def frame(self):
        return None
    def set_atoms(self, ids):
        print("[stage.selection.set_atoms] not yet bridged", list(ids))
    def clear(self):
        print("[stage.selection.clear] not yet bridged")

def _normalize_script_name(name):
    s = str(name).strip().lstrip("/")
    if not s:
        raise ValueError("empty script name")
    return s if s.endswith(".py") else s + ".py"

def run(script, /, **_kwargs):
    """Execute a named script from the MolVis script library.

    >>> import molvis as mv
    >>> mv.run("camera.py")
    """
    key = _normalize_script_name(script)
    source = _MOLVIS_SCRIPTS.get(key)
    if source is None:
        known = ", ".join(sorted(_MOLVIS_SCRIPTS)) or "(none)"
        raise FileNotFoundError(
            f"script not found: {key!r}. Known: {known}"
        )
    g = {
        "__name__": f"__molvis_script__:{key}",
        "__file__": key,
        "mv": sys.modules.get("molvis"),
        "stage": stage,
        "math": math,
    }
    exec(compile(source, key, "exec"), g)
    return None

def list_scripts():
    return sorted(_MOLVIS_SCRIPTS.keys())

_mod = types.ModuleType("molvis")
_mod.Stage = Stage
_mod.run = run
_mod.list_scripts = list_scripts
_mod.__version__ = "0.0.0+pyodide"
sys.modules["molvis"] = _mod

stage = Stage()
_mod._default_stage = stage
`;class f{status="idle";pyodide=null;listeners=new Set;logs=[];logSeq=0;runLock=!1;lastError=null;scripts={};bridge=null;setBridge(e){this.bridge=e,this.pyodide&&e&&this.pyodide.registerJsModule("molvis_host",{call:(t,r)=>e.call(t,r??{})})}getStatus(){return this.status}getLastError(){return this.lastError}getLogs(){return this.logs}getScripts(){return{...this.scripts}}subscribe(e){return this.listeners.add(e),()=>{this.listeners.delete(e)}}emit(){for(let e of this.listeners)try{e()}catch{}}setStatus(e){this.status=e,this.emit()}pushLog(e){this.logs=[...this.logs,{...e,id:`log-${++this.logSeq}`,at:Date.now()}].slice(-2e3),this.emit()}clearLogs(){this.logs=[],this.emit()}async syncScripts(e){if(this.scripts={...e},!this.pyodide)return;let t=JSON.stringify(this.scripts);await this.pyodide.runPythonAsync(`
import sys
_payload = __import__("json").loads(${JSON.stringify(t)})
g = sys.modules.get("molvis")
if g is not None and hasattr(g, "run"):
    g.run.__globals__["_MOLVIS_SCRIPTS"] = _payload
`)}async start(){if(!this.pyodide){if("loading"===this.status)return void await this.waitUntilReady();this.setStatus("loading"),this.lastError=null,this.pushLog({source:"system",stream:"info",text:"Loading Pyodide…"});try{this.pyodide=await m();let e=this.bridge;this.pyodide.registerJsModule("molvis_host",{call:(e,t)=>{if(!this.bridge)throw Error("molvis host bridge not bound");return this.bridge.call(e,t??{})}}),e||this.pushLog({source:"system",stream:"info",text:"Host bridge not bound yet — camera calls will fail until app is ready."}),await this.bootstrapNamespace(),this.setStatus("ready"),this.pushLog({source:"system",stream:"info",text:'Pyodide ready. stage.camera.* is live; mv.run("camera.py") uses the script library.'})}catch(t){let e=t instanceof Error?t.message:String(t);throw this.lastError=e,this.setStatus("error"),this.pushLog({source:"system",stream:"stderr",text:`Failed to load Pyodide: ${e}`}),t}}}async waitUntilReady(){let e=Date.now();for(;"loading"===this.status&&Date.now()-e<12e4;)await new Promise(e=>setTimeout(e,50));if("error"===this.status)throw Error(this.lastError??"kernel error")}async bootstrapNamespace(){if(!this.pyodide)return;let e=JSON.stringify(this.scripts);await this.pyodide.runPythonAsync(`_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(e)})
`+y);try{await this.pyodide.loadPackage("micropip"),await this.pyodide.runPythonAsync('print("[kernel] micropip available; molpy wheel install TBD")')}catch{}}async run(e,t,r){if(this.runLock){let e="Kernel busy — wait for the current run to finish.";return this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId}),{ok:!1,stdout:"",stderr:e,error:e}}if(await this.start(),!this.pyodide){let e=this.lastError??"Kernel not ready";return{ok:!1,stdout:"",stderr:e,error:e}}this.runLock=!0,this.setStatus("busy");let i="",s="";this.pyodide.setStdout({batched:e=>{i+=e,this.pushLog({source:t,stream:"stdout",text:e,cellId:r?.cellId})}}),this.pyodide.setStderr({batched:e=>{s+=e,this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId})}});try{let o,n=await this.pyodide.runPythonAsync(e);return null!=n&&(o=String(n),this.pushLog({source:t,stream:"stdout",text:o,cellId:r?.cellId})),this.setStatus("ready"),{ok:!0,stdout:i,stderr:s,resultText:o}}catch(o){let e=o instanceof Error?o.message:String(o);return this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId}),this.setStatus("ready"),{ok:!1,stdout:i,stderr:s+e,error:e}}finally{this.runLock=!1}}async runNamedScript(e){let t=e.endsWith(".py")?e:`${e}.py`;return this.run(`import molvis as mv
mv.run(${JSON.stringify(t)})`,"script")}async reset(){this.pyodide=null,this.runLock=!1,this.lastError=null,this.setStatus("idle"),this.pushLog({source:"system",stream:"info",text:"Kernel reset."}),await this.start()}}let h=null;function g(){return h||(h=new f),h}function v(){let e=g(),t=n(t=>e.subscribe(t),()=>e.getStatus(),()=>e.getStatus()),i=n(t=>e.subscribe(t),()=>e.getLogs(),()=>e.getLogs()),s=r(()=>e.start(),[e]),o=r(()=>e.reset(),[e]),a=r(()=>e.clearLogs(),[e]),l=r((t,r,i)=>e.run(t,r,i),[e]),d=r(t=>e.runNamedScript(t),[e]),c=r(t=>e.syncScripts(t),[e]);return{status:t,logs:i,lastError:e.getLastError(),start:s,reset:o,clearLogs:a,run:l,runNamedScript:d,syncScripts:c}}let b={display:"flex",flexDirection:"column",height:"100%",minHeight:0,fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',fontSize:12,color:"var(--molvis-fg, #14271d)",background:"var(--molvis-surface, #f7faf8)"},_={display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"6px 8px",borderBottom:"1px solid var(--molvis-border, #cad5ce)",background:"var(--molvis-muted, #eef3f0)",flexShrink:0},x=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"ghost";return{border:"ghost"===e?"1px solid var(--molvis-border, #cad5ce)":"none",background:"primary"===e?"var(--molvis-accent, #1f6f4a)":"danger"===e?"rgba(180,40,40,0.12)":"transparent",color:"primary"===e?"#fff":"var(--molvis-fg, #14271d)",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}},S={marginLeft:"auto",fontSize:11,color:"var(--molvis-muted-fg, #5a6b62)",fontFamily:"ui-monospace, Menlo, Consolas, monospace"},w={flex:1,minHeight:0,overflow:"auto",padding:8,display:"flex",flexDirection:"column",gap:10},k={border:"1px solid var(--molvis-border, #cad5ce)",borderRadius:8,overflow:"hidden",background:"var(--molvis-surface, #fff)"},C={display:"flex",alignItems:"center",gap:6,padding:"4px 8px",background:"var(--molvis-muted, #eef3f0)",borderBottom:"1px solid var(--molvis-border, #e2eae5)",fontSize:11,fontWeight:600},I={width:"100%",minHeight:72,border:"none",resize:"vertical",padding:8,fontFamily:"ui-monospace, Menlo, Consolas, monospace",fontSize:12,lineHeight:1.45,background:"transparent",color:"inherit",outline:"none",boxSizing:"border-box"},N={borderTop:"1px solid var(--molvis-border, #e2eae5)",padding:8,whiteSpace:"pre-wrap",fontFamily:"ui-monospace, Menlo, Consolas, monospace",fontSize:11,background:"rgba(0,0,0,0.03)",maxHeight:160,overflow:"auto"},P={height:"100%",minHeight:0,display:"flex",flexDirection:"column"},L={display:"flex",gap:6,padding:"4px 8px",borderBottom:"1px solid var(--molvis-border, #cad5ce)",flexShrink:0},E={flex:1,minHeight:0,padding:4},$={display:"flex",flexDirection:"column",height:"min(70vh, 640px)",minHeight:320},M={flex:1,minHeight:0},O={width:"100%",height:"100%",minHeight:280};async function z(){if("u">typeof document){let e="molvis-xterm-css";if(!document.getElementById(e)){let t=document.createElement("link");t.id=e,t.rel="stylesheet",t.href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css",document.head.appendChild(t)}}let[e,t]=await Promise.all([import("https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm"),import("https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm")]);return{Terminal:e.Terminal??e.default?.Terminal??e.default,FitAddon:t.FitAddon??t.default?.FitAddon??t.default}}function A(r){let{logs:o,clearLogs:n,status:a}=v(),l=s(null),d=s(null),c=s(null),u=s(new Set),p=s(!1);return i(()=>{let e=!1,t=null;return(async()=>{try{let{Terminal:r,FitAddon:i}=await z();if(e||!l.current)return;let s=new r({convertEol:!0,fontSize:12,fontFamily:"ui-monospace, Menlo, Consolas, monospace",theme:{background:"#0f1412",foreground:"#e8f0eb",cursor:"#e8f0eb"},disableStdin:!0}),o=new i;s.loadAddon(o),s.open(l.current),o.fit(),s.writeln("MolVis Python console"),s.writeln(`status: ${a}`),c.current=s,(t=new ResizeObserver(()=>{try{o.fit()}catch{}})).observe(l.current)}catch{p.current=!0}})(),()=>{e=!0,t?.disconnect(),c.current?.dispose(),c.current=null,u.current.clear()}},[a]),i(()=>{let e=c.current;for(let t of o){if(u.current.has(t.id))continue;u.current.add(t.id);let r="system"===t.source?"[sys] ":"script"===t.source?"[script] ":t.cellId?`[cell ${t.cellId.slice(-4)}] `:"[cell] ",i=`${r}${t.text}`;if(e){let i="stderr"===t.stream?"\x1b[31m":"info"===t.stream?"\x1b[36m":"",s=i?"\x1b[0m":"";for(let o of t.text.split("\n"))e.writeln(`${i}${r}${o}${s}`)}else d.current&&(d.current.textContent=(d.current.textContent??"")+i+"\n",d.current.scrollTop=d.current.scrollHeight)}},[o]),t("div",{style:P,children:[t("div",{style:L,children:[e("button",{type:"button",style:x(),onClick:()=>{n(),u.current.clear(),d.current&&(d.current.textContent="")},children:"Clear"}),t("span",{style:S,children:["kernel: ",a]})]}),e("div",{ref:l,style:E}),e("pre",{ref:d,style:{...N,display:c.current?"none":"block",flex:1,maxHeight:"none",margin:0,background:"#0f1412",color:"#e8f0eb"}})]})}let R="notebook.v1";function D(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"";return{id:`cell-${Math.random().toString(36).slice(2,10)}`,source:e,output:"",execCount:null,status:"idle"}}function j(){return{cells:[D("# Notebook cells are plain text (no Monaco).\n# Named scripts live in the Script dialog; call them here:\nimport molvis as mv\nprint('scripts:', mv.list_scripts())\nmv.run(\"camera.py\")  # runs the library script")],nextExec:1}}function T(e,t){try{e?.setItem(R,JSON.stringify(t))}catch{}}let V="scripts.v1",B=`\
# camera.py — custom camera trajectory (called via mv.run("camera.py"))
# Globals: stage (mv.Stage), mv (molvis module)
# stage.camera.* is InProcess-bridged to the live viewer.
import math

stage.camera.fit_view()
n = 36
for i in range(n):
    alpha = (2 * math.pi * i) / n
    stage.camera.set_pose(alpha=alpha, beta=1.1)
    print(f"frame {i + 1}/{n}  alpha={alpha:.3f}")
print("camera path done")
`,H=`\
# hello.py — sample script
print("hello from", __name__)
print("stage.mode =", stage.mode)
# Nested scripts work:
# mv.run("camera.py")
`;function J(e){let t=e.trim().replace(/^\/+/,"");return t?t.endsWith(".py")?t:`${t}.py`:"untitled.py"}function F(){let e=J("camera.py"),t=J("hello.py"),r=Date.now();return{version:1,active:e,files:{[e]:{name:e,source:B,updatedAt:r},[t]:{name:t,source:H,updatedAt:r}}}}function K(e){if(!e)return F();try{let t=e.getItem(V);if(!t)return F();let r=JSON.parse(t);if(r?.version!==1||!r.files||"object"!=typeof r.files)return F();let i=Object.keys(r.files);if(0===i.length)return F();let s=r.active&&r.files[r.active]?r.active:i[0];return{version:1,active:s,files:r.files}}catch{return F()}}function W(e,t){try{e?.setItem(V,JSON.stringify(t))}catch{}}function q(e,t){let r=J(t);return e.files[r]?.source??null}function U(e,t,r){let i=J(t);return{...e,active:i,files:{...e.files,[i]:{name:i,source:r,updatedAt:Date.now()}}}}function G(e){let t={};for(let[r,i]of Object.entries(e.files))t[r]=i.source;return t}function Q(s){let{storage:n}=s,{status:a,run:l,start:d,reset:c,syncScripts:u}=v(),[p,m]=o(()=>(function(e){if(!e)return j();try{let t=e.getItem(R);if(!t)return j();let r=JSON.parse(t);if(!Array.isArray(r.cells)||0===r.cells.length)return j();return r}catch{return j()}})(n));i(()=>{u(G(K(n)))},[n,u]);let y=r(e=>{m(e),T(n,e)},[n]),f=(e,t)=>{y({...p,cells:p.cells.map(r=>r.id===e?{...r,...t}:r)})},h=async e=>{let t=p.cells.find(t=>t.id===e);if(!t)return;f(e,{status:"running",output:""});let r=await l(t.source,"cell",{cellId:e}),i=[r.stdout,r.stderr,r.resultText,r.error].filter(Boolean).join("");m(t=>{let s={nextExec:r.ok?t.nextExec+1:t.nextExec,cells:t.cells.map(s=>s.id===e?{...s,status:r.ok?"ok":"error",output:i||(r.ok?"(no output)":r.error??""),execCount:r.ok?t.nextExec:s.execCount}:s)};return T(n,s),s})},g=async()=>{for(let e of p.cells)await h(e.id)};return t("div",{style:b,children:[t("div",{style:_,children:[e("button",{type:"button",style:x("primary"),onClick:()=>void d(),disabled:"loading"===a||"busy"===a,children:"Start kernel"}),e("button",{type:"button",style:x(),onClick:()=>y({...p,cells:[...p.cells,D()]}),children:"+ Cell"}),e("button",{type:"button",style:x("primary"),onClick:()=>void g(),disabled:"busy"===a||"loading"===a,children:"Run all"}),e("button",{type:"button",style:x("danger"),onClick:()=>{globalThis.confirm?.("Reset Python kernel?")&&c()},children:"Reset"}),t("span",{style:S,children:["kernel: ",a]})]}),e("div",{style:w,children:p.cells.map((r,i)=>t("div",{style:k,children:[t("div",{style:C,children:[t("span",{children:["In [",r.execCount??" ","] · #",i+1]}),e("button",{type:"button",style:x("primary"),disabled:"busy"===a,onClick:()=>void h(r.id),children:"Run"}),e("button",{type:"button",style:x(),onClick:()=>y({...p,cells:p.cells.filter(e=>e.id!==r.id).length?p.cells.filter(e=>e.id!==r.id):[D()]}),children:"Delete"}),e("span",{style:{marginLeft:"auto",opacity:.7},children:r.status})]}),e("textarea",{style:I,value:r.source,spellCheck:!1,onChange:e=>f(r.id,{source:e.target.value}),onKeyDown:e=>{(e.metaKey||e.ctrlKey)&&"Enter"===e.key&&(e.preventDefault(),h(r.id))}}),r.output?e("div",{style:N,children:r.output}):null]},r.id))})]})}let X=null;function Y(n){let{storage:a,close:l}=n,{status:d,run:c,runNamedScript:u,start:p,syncScripts:m}=v(),y=s(null),f=s(null),[h,g]=o(()=>K(a)),[b,w]=o(!1),[k,C]=o(""),[N,P]=o(!1),[L,E]=o(""),[z,A]=o(""),R=q(h,h.active)??"# empty script\n",D=r(e=>{g(e),W(a,e),m(G(e))},[a,m]);i(()=>{m(G(h))},[]),i(()=>{let e=!1;return E(R),(async()=>{try{let t=await (!X&&(X=import("https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/+esm").then(e=>e.default??e)),X);if(e||!y.current)return;if(f.current){f.current.setValue(R),P(!0);return}let r=t.editor.create(y.current,{value:R,language:"python",automaticLayout:!0,minimap:{enabled:!1},fontSize:13,lineNumbers:"on",wordWrap:"on",scrollBeyondLastLine:!1,theme:"vs"});f.current=r,P(!0),r.onDidChangeModelContent(()=>{let e=r.getValue();g(t=>{let r=U(t,t.active,e);return W(a,r),m(G(r)),r})})}catch{P(!1)}})(),()=>{e=!0}},[a]),i(()=>{let e=q(h,h.active)??"";E(e),f.current&&f.current.getValue()!==e&&f.current.setValue(e)},[h.active]),i(()=>()=>{f.current?.dispose(),f.current=null},[]);let j=()=>f.current?.getValue()??L,T=()=>{let e=j();D(U(h,h.active,e)),C(`Saved ${h.active}`)},V=async()=>{T(),w(!0),C(`Running ${h.active}…`);try{await p(),await m(G(h));let e=await u(h.active);C(e.ok?`Done ${h.active} — see Console`:e.error??"Error")}finally{w(!1)}},B=async()=>{T(),w(!0),C(`mv.run(${JSON.stringify(h.active)})…`);try{await p(),await m(G(h));let e=await c(`import molvis as mv
mv.run(${JSON.stringify(h.active)})`,"script");C(e.ok?"mv.run done — see Console":e.error??"Error")}finally{w(!1)}},H=Object.keys(h.files).sort((e,t)=>e.localeCompare(t));return t("div",{style:$,children:[t("div",{style:_,children:[t("label",{style:{display:"flex",alignItems:"center",gap:4},children:[e("span",{style:{opacity:.7},children:"File"}),e("select",{value:h.active,onChange:e=>{let t=e.target.value,r=j();D({...U(h,h.active,r),active:t})},style:{fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid var(--molvis-border, #cad5ce)",maxWidth:160},children:H.map(t=>e("option",{value:t,children:t},t))})]}),e("input",{type:"text",placeholder:"new.py",value:z,onChange:e=>A(e.target.value),style:{width:90,fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid var(--molvis-border, #cad5ce)"}}),e("button",{type:"button",style:x(),onClick:()=>{if(!z.trim())return;let e=J(z),t=j(),r=U(h,h.active,t);D(U(r,e,`# ${e}
print("new script")
`)),A(""),C(`Created ${e}`)},children:"New"}),e("button",{type:"button",style:x(),onClick:T,children:"Save"}),e("button",{type:"button",style:x(),onClick:()=>{globalThis.confirm?.(`Delete ${h.active}?`)&&D(function(e,t){let r=J(t),{[r]:i,...s}=e.files,o=Object.keys(s);return 0===o.length?F():{version:1,active:e.active===r?o.sort()[0]:e.active,files:s}}(h,h.active))},children:"Delete"}),e("button",{type:"button",style:x("primary"),disabled:b||"busy"===d,onClick:()=>void V(),children:"Run"}),e("button",{type:"button",style:x("primary"),disabled:b||"busy"===d,title:'import molvis as mv; mv.run("…")',onClick:()=>void B(),children:"mv.run"}),e("button",{type:"button",style:x(),onClick:l,children:"Close"}),t("span",{style:S,children:[k||`kernel: ${d}`," · Monaco · Mod+Enter",N?"":" · textarea fallback"]})]}),t("div",{style:{padding:"4px 10px",fontSize:11,opacity:.75,borderBottom:"1px solid var(--molvis-border, #e2eae5)"},children:["Call from notebook:"," ",e("code",{children:`import molvis as mv; mv.run("${h.active}")`})]}),t("div",{style:M,children:[e("div",{ref:y,style:{...O,display:N?"block":"none"},onKeyDown:e=>{(e.metaKey||e.ctrlKey)&&"Enter"===e.key&&(e.preventDefault(),V())}}),!N&&e("textarea",{style:{...I,height:"100%",minHeight:280},value:L,spellCheck:!1,onChange:e=>{E(e.target.value),D(U(h,h.active,e.target.value))},onKeyDown:e=>{(e.metaKey||e.ctrlKey)&&"Enter"===e.key&&(e.preventDefault(),V())}})]})]})}function Z(r){var i;let s="python",o=g();o.setBridge(u(r.app)),r.modes.register(s,(i=`plugin.${r.pluginId}.${s}`,e=>({name:i,start(){},finish(){}})),{tab:{label:"Python",order:50},panel:{id:"notebook",title:"Notebook",render:t=>{let{app:i}=t;return o.setBridge(u(i??r.app)),e(Q,{app:i,storage:r.storage})}}}),r.panels.register({id:"console",position:"bottom",title:"Console",defaultOpen:!1,defaultSize:.28,render:t=>{let{app:r}=t;return e(A,{app:r})}}),r.dialogs.register({id:"script",title:"Python script",size:"xl",render:t=>{let{app:i,close:s}=t;return o.setBridge(u(i??r.app)),e(Y,{app:i,storage:r.storage,close:s})}}),r.commands.register("open-script",()=>{},{toolbar:{label:"Python: Open script",order:45,opensDialog:"script"}}),r.commands.register("open-notebook",()=>{r.app.setMode(`plugin.${r.pluginId}.python`)},{toolbar:{label:"Python: Notebook",order:40}}),r.settings.registerSection({id:"about",title:"Pyodide · molpy",order:80,render:()=>t("div",{style:{padding:8,fontSize:12,lineHeight:1.5},children:[e("p",{style:{margin:"0 0 8px"},children:"Browser Python via Pyodide. Notebook cells (plain text, no Monaco), Script library (Monaco only), and Console (xterm) share one kernel."}),t("p",{style:{margin:0,opacity:.75},children:["Named scripts: ",e("code",{children:'import molvis as mv; mv.run("camera.py")'})," ","or ",e("code",{children:'stage.run("camera.py")'}),"."," ",e("code",{children:"stage.camera.set_pose / fit_view / look_at"})," drive the live viewer via InProcess bridge."]})]})}),r.rpc.registerMethod("kernelStatus",()=>({status:o.getStatus()})),r.rpc.registerMethod("runScript",async e=>{let t=String(e.name??e.script??"");return t?(o.setBridge(u(r.app)),o.runNamedScript(t)):{ok:!1,error:"name required"}})}var ee={id:"com.molcrafts.pyodide-molpy",name:"Pyodide · molpy",version:"0.1.0",activate(e){e.log.info("pyodide-molpy activate"),Z(e)},deactivate(e){g().setBridge(null),e.log.info("pyodide-molpy deactivate")}},et=l.A,er=l.n;export{et as default,er as registerPyodideMolpy};