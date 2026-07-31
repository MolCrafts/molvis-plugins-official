import{useCallback as e,useEffect as t,useRef as r,useState as a,useSyncExternalStore as s}from"react";var i={};i.d=(e,t,r)=>{var a=(t,r)=>{for(var a in t)i.o(t,a)&&!i.o(e,a)&&Object.defineProperty(e,a,{enumerable:!0,[r]:t[a]})};a(t,"get"),a(r,"value")},i.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);var o={};function n(e){let t=e.getTarget();return{alpha:e.alpha,beta:e.beta,radius:e.radius,target:[t.x,t.y,t.z],position:[e.position.x,e.position.y,e.position.z],up:[e.upVector.x,e.upVector.y,e.upVector.z]}}function l(e){try{e.world.renderOnce?.()}catch{}}function c(e){return{call(t){let r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!e)throw Error("molvis app is not available");let a=e.world.camera;if(!a)throw Error("world.camera is not available");switch(t){case"camera.get_pose":return n(a);case"camera.set_pose":if("number"==typeof r.alpha&&(a.alpha=r.alpha),"number"==typeof r.beta&&(a.beta=r.beta),"number"==typeof r.radius&&(a.radius=Math.max(.01,r.radius)),Array.isArray(r.target)&&r.target.length>=3){let e=r.target;a.setTarget({x:e[0],y:e[1],z:e[2]})}return a.rebuildAnglesAndRadius?.(),l(e),{pose:n(a)};case"camera.look_at":{let t=r.position,s=r.target;if(!t||!s||t.length<3||s.length<3)throw Error("look_at requires position and target length-3 arrays");if(Array.isArray(r.up)&&r.up.length>=3){let e=r.up;a.upVector={x:e[0],y:e[1],z:e[2]}}return a.setTarget({x:s[0],y:s[1],z:s[2]}),a.setPosition?a.setPosition({x:t[0],y:t[1],z:t[2]}):(a.position.x=t[0],a.position.y=t[1],a.position.z=t[2]),a.rebuildAnglesAndRadius?.(),l(e),{pose:n(a)}}case"camera.fit_view":return e.world.resetCamera?e.world.resetCamera({viewDirection:"iso"}):e.resetCamera?.(),l(e),{pose:n(a)};default:throw Error(`unknown bridge method: ${t}`)}}}}i.d(o,{A:()=>Y,n:()=>X});let d="https://cdn.jsdelivr.net/pyodide/v314.0.3/full/";async function u(){let e=`${d}pyodide.mjs`;return(0,(await import(e)).loadPyodide)({indexURL:d})}let p=`
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
`;class m{status="idle";pyodide=null;listeners=new Set;logs=[];logSeq=0;runLock=!1;lastError=null;scripts={};bridge=null;setBridge(e){this.bridge=e,this.pyodide&&e&&this.pyodide.registerJsModule("molvis_host",{call:(t,r)=>e.call(t,r??{})})}getStatus(){return this.status}getLastError(){return this.lastError}getLogs(){return this.logs}getScripts(){return{...this.scripts}}subscribe(e){return this.listeners.add(e),()=>{this.listeners.delete(e)}}emit(){for(let e of this.listeners)try{e()}catch{}}setStatus(e){this.status=e,this.emit()}pushLog(e){this.logs=[...this.logs,{...e,id:`log-${++this.logSeq}`,at:Date.now()}].slice(-2e3),this.emit()}clearLogs(){this.logs=[],this.emit()}async syncScripts(e){if(this.scripts={...e},!this.pyodide)return;let t=JSON.stringify(this.scripts);await this.pyodide.runPythonAsync(`
import sys
_payload = __import__("json").loads(${JSON.stringify(t)})
g = sys.modules.get("molvis")
if g is not None and hasattr(g, "run"):
    g.run.__globals__["_MOLVIS_SCRIPTS"] = _payload
`)}async start(){if(!this.pyodide){if("loading"===this.status)return void await this.waitUntilReady();this.setStatus("loading"),this.lastError=null,this.pushLog({source:"system",stream:"info",text:"Loading Pyodide…"});try{this.pyodide=await u();let e=this.bridge;this.pyodide.registerJsModule("molvis_host",{call:(e,t)=>{if(!this.bridge)throw Error("molvis host bridge not bound");return this.bridge.call(e,t??{})}}),e||this.pushLog({source:"system",stream:"info",text:"Host bridge not bound yet — camera calls will fail until app is ready."}),await this.bootstrapNamespace(),this.setStatus("ready"),this.pushLog({source:"system",stream:"info",text:'Pyodide ready. stage.camera.* is live; mv.run("camera.py") uses the script library.'})}catch(t){let e=t instanceof Error?t.message:String(t);throw this.lastError=e,this.setStatus("error"),this.pushLog({source:"system",stream:"stderr",text:`Failed to load Pyodide: ${e}`}),t}}}async waitUntilReady(){let e=Date.now();for(;"loading"===this.status&&Date.now()-e<12e4;)await new Promise(e=>setTimeout(e,50));if("error"===this.status)throw Error(this.lastError??"kernel error")}async bootstrapNamespace(){if(!this.pyodide)return;let e=JSON.stringify(this.scripts);await this.pyodide.runPythonAsync(`_MOLVIS_SCRIPTS = __import__("json").loads(${JSON.stringify(e)})
`+p);try{await this.pyodide.loadPackage("micropip"),await this.pyodide.runPythonAsync('print("[kernel] micropip available; molpy wheel install TBD")')}catch{}}async run(e,t,r){if(this.runLock){let e="Kernel busy — wait for the current run to finish.";return this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId}),{ok:!1,stdout:"",stderr:e,error:e}}if(await this.start(),!this.pyodide){let e=this.lastError??"Kernel not ready";return{ok:!1,stdout:"",stderr:e,error:e}}this.runLock=!0,this.setStatus("busy");let a="",s="";this.pyodide.setStdout({batched:e=>{a+=e,this.pushLog({source:t,stream:"stdout",text:e,cellId:r?.cellId})}}),this.pyodide.setStderr({batched:e=>{s+=e,this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId})}});try{let i,o=await this.pyodide.runPythonAsync(e);return null!=o&&(i=String(o),this.pushLog({source:t,stream:"stdout",text:i,cellId:r?.cellId})),this.setStatus("ready"),{ok:!0,stdout:a,stderr:s,resultText:i}}catch(i){let e=i instanceof Error?i.message:String(i);return this.pushLog({source:t,stream:"stderr",text:e,cellId:r?.cellId}),this.setStatus("ready"),{ok:!1,stdout:a,stderr:s+e,error:e}}finally{this.runLock=!1}}async runNamedScript(e){let t=e.endsWith(".py")?e:`${e}.py`;return this.run(`import molvis as mv
mv.run(${JSON.stringify(t)})`,"script")}async reset(){this.pyodide=null,this.runLock=!1,this.lastError=null,this.setStatus("idle"),this.pushLog({source:"system",stream:"info",text:"Kernel reset."}),await this.start()}}let y=null;function f(){return y||(y=new m),y}function g(){let t=f(),r=s(e=>t.subscribe(e),()=>t.getStatus(),()=>t.getStatus()),a=s(e=>t.subscribe(e),()=>t.getLogs(),()=>t.getLogs()),i=e(()=>t.start(),[t]),o=e(()=>t.reset(),[t]),n=e(()=>t.clearLogs(),[t]),l=e((e,r,a)=>t.run(e,r,a),[t]),c=e(e=>t.runNamedScript(e),[t]),d=e(e=>t.syncScripts(e),[t]);return{status:r,logs:a,lastError:t.getLastError(),start:i,reset:o,clearLogs:n,run:l,runNamedScript:c,syncScripts:d}}let h={display:"flex",flexDirection:"column",height:"100%",minHeight:0,fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',fontSize:12,color:"var(--molvis-fg, #14271d)",background:"var(--molvis-surface, #f7faf8)"},v={display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"6px 8px",borderBottom:"1px solid var(--molvis-border, #cad5ce)",background:"var(--molvis-muted, #eef3f0)",flexShrink:0},b=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"ghost";return{border:"ghost"===e?"1px solid var(--molvis-border, #cad5ce)":"none",background:"primary"===e?"var(--molvis-accent, #1f6f4a)":"danger"===e?"rgba(180,40,40,0.12)":"transparent",color:"primary"===e?"#fff":"var(--molvis-fg, #14271d)",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}},_={marginLeft:"auto",fontSize:11,color:"var(--molvis-muted-fg, #5a6b62)",fontFamily:"ui-monospace, Menlo, Consolas, monospace"},x={flex:1,minHeight:0,overflow:"auto",padding:8,display:"flex",flexDirection:"column",gap:10},S={border:"1px solid var(--molvis-border, #cad5ce)",borderRadius:8,overflow:"hidden",background:"var(--molvis-surface, #fff)"},w={display:"flex",alignItems:"center",gap:6,padding:"4px 8px",background:"var(--molvis-muted, #eef3f0)",borderBottom:"1px solid var(--molvis-border, #e2eae5)",fontSize:11,fontWeight:600},k={width:"100%",minHeight:72,border:"none",resize:"vertical",padding:8,fontFamily:"ui-monospace, Menlo, Consolas, monospace",fontSize:12,lineHeight:1.45,background:"transparent",color:"inherit",outline:"none",boxSizing:"border-box"},E={borderTop:"1px solid var(--molvis-border, #e2eae5)",padding:8,whiteSpace:"pre-wrap",fontFamily:"ui-monospace, Menlo, Consolas, monospace",fontSize:11,background:"rgba(0,0,0,0.03)",maxHeight:160,overflow:"auto"},R={height:"100%",minHeight:0,display:"flex",flexDirection:"column"},C={display:"flex",gap:6,padding:"4px 8px",borderBottom:"1px solid var(--molvis-border, #cad5ce)",flexShrink:0},I={flex:1,minHeight:0,padding:4},N={display:"flex",flexDirection:"column",height:"min(70vh, 640px)",minHeight:320},P={flex:1,minHeight:0},L={width:"100%",height:"100%",minHeight:280};async function $(){if("u">typeof document){let e="molvis-xterm-css";if(!document.getElementById(e)){let t=document.createElement("link");t.id=e,t.rel="stylesheet",t.href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css",document.head.appendChild(t)}}let[e,t]=await Promise.all([import("https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm"),import("https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm")]);return{Terminal:e.Terminal??e.default?.Terminal??e.default,FitAddon:t.FitAddon??t.default?.FitAddon??t.default}}function M(e){let{logs:a,clearLogs:s,status:i}=g(),o=r(null),n=r(null),l=r(null),c=r(new Set),d=r(!1);return t(()=>{let e=!1,t=null;return(async()=>{try{let{Terminal:r,FitAddon:a}=await $();if(e||!o.current)return;let s=new r({convertEol:!0,fontSize:12,fontFamily:"ui-monospace, Menlo, Consolas, monospace",theme:{background:"#0f1412",foreground:"#e8f0eb",cursor:"#e8f0eb"},disableStdin:!0}),n=new a;s.loadAddon(n),s.open(o.current),n.fit(),s.writeln("MolVis Python console"),s.writeln(`status: ${i}`),l.current=s,(t=new ResizeObserver(()=>{try{n.fit()}catch{}})).observe(o.current)}catch{d.current=!0}})(),()=>{e=!0,t?.disconnect(),l.current?.dispose(),l.current=null,c.current.clear()}},[i]),t(()=>{let e=l.current;for(let t of a){if(c.current.has(t.id))continue;c.current.add(t.id);let r="system"===t.source?"[sys] ":"script"===t.source?"[script] ":t.cellId?`[cell ${t.cellId.slice(-4)}] `:"[cell] ",a=`${r}${t.text}`;if(e){let a="stderr"===t.stream?"\x1b[31m":"info"===t.stream?"\x1b[36m":"",s=a?"\x1b[0m":"";for(let i of t.text.split("\n"))e.writeln(`${a}${r}${i}${s}`)}else n.current&&(n.current.textContent=(n.current.textContent??"")+a+"\n",n.current.scrollTop=n.current.scrollHeight)}},[a]),React.createElement("div",{style:R},React.createElement("div",{style:C},React.createElement("button",{type:"button",style:b(),onClick:()=>{s(),c.current.clear(),n.current&&(n.current.textContent="")}},"Clear"),React.createElement("span",{style:_},"kernel: ",i)),React.createElement("div",{ref:o,style:I}),React.createElement("pre",{ref:n,style:{...E,display:l.current?"none":"block",flex:1,maxHeight:"none",margin:0,background:"#0f1412",color:"#e8f0eb"}}))}let O="notebook.v1";function z(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"";return{id:`cell-${Math.random().toString(36).slice(2,10)}`,source:e,output:"",execCount:null,status:"idle"}}function A(){return{cells:[z("# Notebook cells are plain text (no Monaco).\n# Named scripts live in the Script dialog; call them here:\nimport molvis as mv\nprint('scripts:', mv.list_scripts())\nmv.run(\"camera.py\")  # runs the library script")],nextExec:1}}function D(e,t){try{e?.setItem(O,JSON.stringify(t))}catch{}}let T="scripts.v1",j=`\
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
`,V=`\
# hello.py — sample script
print("hello from", __name__)
print("stage.mode =", stage.mode)
# Nested scripts work:
# mv.run("camera.py")
`;function B(e){let t=e.trim().replace(/^\/+/,"");return t?t.endsWith(".py")?t:`${t}.py`:"untitled.py"}function H(){let e=B("camera.py"),t=B("hello.py"),r=Date.now();return{version:1,active:e,files:{[e]:{name:e,source:j,updatedAt:r},[t]:{name:t,source:V,updatedAt:r}}}}function J(e){if(!e)return H();try{let t=e.getItem(T);if(!t)return H();let r=JSON.parse(t);if(r?.version!==1||!r.files||"object"!=typeof r.files)return H();let a=Object.keys(r.files);if(0===a.length)return H();let s=r.active&&r.files[r.active]?r.active:a[0];return{version:1,active:s,files:r.files}}catch{return H()}}function F(e,t){try{e?.setItem(T,JSON.stringify(t))}catch{}}function K(e,t){let r=B(t);return e.files[r]?.source??null}function W(e,t,r){let a=B(t);return{...e,active:a,files:{...e.files,[a]:{name:a,source:r,updatedAt:Date.now()}}}}function q(e){let t={};for(let[r,a]of Object.entries(e.files))t[r]=a.source;return t}function U(r){let{storage:s}=r,{status:i,run:o,start:n,reset:l,syncScripts:c}=g(),[d,u]=a(()=>(function(e){if(!e)return A();try{let t=e.getItem(O);if(!t)return A();let r=JSON.parse(t);if(!Array.isArray(r.cells)||0===r.cells.length)return A();return r}catch{return A()}})(s));t(()=>{c(q(J(s)))},[s,c]);let p=e(e=>{u(e),D(s,e)},[s]),m=(e,t)=>{p({...d,cells:d.cells.map(r=>r.id===e?{...r,...t}:r)})},y=async e=>{let t=d.cells.find(t=>t.id===e);if(!t)return;m(e,{status:"running",output:""});let r=await o(t.source,"cell",{cellId:e}),a=[r.stdout,r.stderr,r.resultText,r.error].filter(Boolean).join("");u(t=>{let i={nextExec:r.ok?t.nextExec+1:t.nextExec,cells:t.cells.map(s=>s.id===e?{...s,status:r.ok?"ok":"error",output:a||(r.ok?"(no output)":r.error??""),execCount:r.ok?t.nextExec:s.execCount}:s)};return D(s,i),i})},f=async()=>{for(let e of d.cells)await y(e.id)};return React.createElement("div",{style:h},React.createElement("div",{style:v},React.createElement("button",{type:"button",style:b("primary"),onClick:()=>void n(),disabled:"loading"===i||"busy"===i},"Start kernel"),React.createElement("button",{type:"button",style:b(),onClick:()=>p({...d,cells:[...d.cells,z()]})},"+ Cell"),React.createElement("button",{type:"button",style:b("primary"),onClick:()=>void f(),disabled:"busy"===i||"loading"===i},"Run all"),React.createElement("button",{type:"button",style:b("danger"),onClick:()=>{globalThis.confirm?.("Reset Python kernel?")&&l()}},"Reset"),React.createElement("span",{style:_},"kernel: ",i)),React.createElement("div",{style:x},d.cells.map((e,t)=>React.createElement("div",{key:e.id,style:S},React.createElement("div",{style:w},React.createElement("span",null,"In [",e.execCount??" ","] · #",t+1),React.createElement("button",{type:"button",style:b("primary"),disabled:"busy"===i,onClick:()=>void y(e.id)},"Run"),React.createElement("button",{type:"button",style:b(),onClick:()=>p({...d,cells:d.cells.filter(t=>t.id!==e.id).length?d.cells.filter(t=>t.id!==e.id):[z()]})},"Delete"),React.createElement("span",{style:{marginLeft:"auto",opacity:.7}},e.status)),React.createElement("textarea",{style:k,value:e.source,spellCheck:!1,onChange:t=>m(e.id,{source:t.target.value}),onKeyDown:t=>{(t.metaKey||t.ctrlKey)&&"Enter"===t.key&&(t.preventDefault(),y(e.id))}}),e.output?React.createElement("div",{style:E},e.output):null))))}let G=null;function Q(s){let{storage:i,close:o}=s,{status:n,run:l,runNamedScript:c,start:d,syncScripts:u}=g(),p=r(null),m=r(null),[y,f]=a(()=>J(i)),[h,x]=a(!1),[S,w]=a(""),[E,R]=a(!1),[C,I]=a(""),[$,M]=a(""),O=K(y,y.active)??"# empty script\n",z=e(e=>{f(e),F(i,e),u(q(e))},[i,u]);t(()=>{u(q(y))},[]),t(()=>{let e=!1;return I(O),(async()=>{try{let t=await (!G&&(G=import("https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/+esm").then(e=>e.default??e)),G);if(e||!p.current)return;if(m.current){m.current.setValue(O),R(!0);return}let r=t.editor.create(p.current,{value:O,language:"python",automaticLayout:!0,minimap:{enabled:!1},fontSize:13,lineNumbers:"on",wordWrap:"on",scrollBeyondLastLine:!1,theme:"vs"});m.current=r,R(!0),r.onDidChangeModelContent(()=>{let e=r.getValue();f(t=>{let r=W(t,t.active,e);return F(i,r),u(q(r)),r})})}catch{R(!1)}})(),()=>{e=!0}},[i]),t(()=>{let e=K(y,y.active)??"";I(e),m.current&&m.current.getValue()!==e&&m.current.setValue(e)},[y.active]),t(()=>()=>{m.current?.dispose(),m.current=null},[]);let A=()=>m.current?.getValue()??C,D=()=>{let e=A();z(W(y,y.active,e)),w(`Saved ${y.active}`)},T=async()=>{D(),x(!0),w(`Running ${y.active}…`);try{await d(),await u(q(y));let e=await c(y.active);w(e.ok?`Done ${y.active} — see Console`:e.error??"Error")}finally{x(!1)}},j=async()=>{D(),x(!0),w(`mv.run(${JSON.stringify(y.active)})…`);try{await d(),await u(q(y));let e=await l(`import molvis as mv
mv.run(${JSON.stringify(y.active)})`,"script");w(e.ok?"mv.run done — see Console":e.error??"Error")}finally{x(!1)}},V=Object.keys(y.files).sort((e,t)=>e.localeCompare(t));return React.createElement("div",{style:N},React.createElement("div",{style:v},React.createElement("label",{style:{display:"flex",alignItems:"center",gap:4}},React.createElement("span",{style:{opacity:.7}},"File"),React.createElement("select",{value:y.active,onChange:e=>{let t=e.target.value,r=A();z({...W(y,y.active,r),active:t})},style:{fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid var(--molvis-border, #cad5ce)",maxWidth:160}},V.map(e=>React.createElement("option",{key:e,value:e},e)))),React.createElement("input",{type:"text",placeholder:"new.py",value:$,onChange:e=>M(e.target.value),style:{width:90,fontSize:12,padding:"2px 6px",borderRadius:4,border:"1px solid var(--molvis-border, #cad5ce)"}}),React.createElement("button",{type:"button",style:b(),onClick:()=>{if(!$.trim())return;let e=B($),t=A(),r=W(y,y.active,t);z(W(r,e,`# ${e}
print("new script")
`)),M(""),w(`Created ${e}`)}},"New"),React.createElement("button",{type:"button",style:b(),onClick:D},"Save"),React.createElement("button",{type:"button",style:b(),onClick:()=>{globalThis.confirm?.(`Delete ${y.active}?`)&&z(function(e,t){let r=B(t),{[r]:a,...s}=e.files,i=Object.keys(s);return 0===i.length?H():{version:1,active:e.active===r?i.sort()[0]:e.active,files:s}}(y,y.active))}},"Delete"),React.createElement("button",{type:"button",style:b("primary"),disabled:h||"busy"===n,onClick:()=>void T()},"Run"),React.createElement("button",{type:"button",style:b("primary"),disabled:h||"busy"===n,title:'import molvis as mv; mv.run("…")',onClick:()=>void j()},"mv.run"),React.createElement("button",{type:"button",style:b(),onClick:o},"Close"),React.createElement("span",{style:_},S||`kernel: ${n}`," · Monaco · Mod+Enter",E?"":" · textarea fallback")),React.createElement("div",{style:{padding:"4px 10px",fontSize:11,opacity:.75,borderBottom:"1px solid var(--molvis-border, #e2eae5)"}},"Call from notebook:"," ",React.createElement("code",null,`import molvis as mv; mv.run("${y.active}")`)),React.createElement("div",{style:P},React.createElement("div",{ref:p,style:{...L,display:E?"block":"none"},onKeyDown:e=>{(e.metaKey||e.ctrlKey)&&"Enter"===e.key&&(e.preventDefault(),T())}}),!E&&React.createElement("textarea",{style:{...k,height:"100%",minHeight:280},value:C,spellCheck:!1,onChange:e=>{I(e.target.value),z(W(y,y.active,e.target.value))},onKeyDown:e=>{(e.metaKey||e.ctrlKey)&&"Enter"===e.key&&(e.preventDefault(),T())}})))}function X(e){var t;let r="python",a=f();a.setBridge(c(e.app)),e.modes.register(r,(t=`plugin.${e.pluginId}.${r}`,e=>({name:t,start(){},finish(){}})),{tab:{label:"Python",order:50},panel:{id:"notebook",title:"Notebook",render:t=>{let{app:r}=t;return a.setBridge(c(r??e.app)),React.createElement(U,{app:r,storage:e.storage})}}}),e.panels.register({id:"console",position:"bottom",title:"Console",defaultOpen:!1,defaultSize:.28,render:e=>{let{app:t}=e;return React.createElement(M,{app:t})}}),e.dialogs.register({id:"script",title:"Python script",size:"xl",render:t=>{let{app:r,close:s}=t;return a.setBridge(c(r??e.app)),React.createElement(Q,{app:r,storage:e.storage,close:s})}}),e.commands.register("open-script",()=>{},{toolbar:{label:"Script",order:45,opensDialog:"script"}}),e.settings.registerSection({id:"about",title:"Pyodide · molpy",order:80,render:()=>React.createElement("div",{style:{padding:8,fontSize:12,lineHeight:1.5}},React.createElement("p",{style:{margin:"0 0 8px"}},"Browser Python via Pyodide. Notebook cells (plain text, no Monaco), Script library (Monaco only), and Console (xterm) share one kernel."),React.createElement("p",{style:{margin:0,opacity:.75}},"Named scripts: ",React.createElement("code",null,'import molvis as mv; mv.run("camera.py")')," ","or ",React.createElement("code",null,'stage.run("camera.py")'),"."," ",React.createElement("code",null,"stage.camera.set_pose / fit_view / look_at")," drive the live viewer via InProcess bridge."))}),e.rpc.registerMethod("kernelStatus",()=>({status:a.getStatus()})),e.rpc.registerMethod("runScript",async t=>{let r=String(t.name??t.script??"");return r?(a.setBridge(c(e.app)),a.runNamedScript(r)):{ok:!1,error:"name required"}})}var Y={id:"com.molcrafts.pyodide-molpy",name:"Pyodide · molpy",version:"0.1.0",activate(e){e.log.info("pyodide-molpy activate"),X(e)},deactivate(e){f().setBridge(null),e.log.info("pyodide-molpy deactivate")}},Z=o.A,ee=o.n;export{Z as default,ee as registerPyodideMolpy};