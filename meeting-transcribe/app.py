#!/usr/bin/env python3
"""회의 녹음 변환기 — 버튼 화면 (브라우저에서 열림, 내 컴퓨터 안에서만 동작).

실행:  python app.py   →  브라우저가 http://127.0.0.1:8765 로 열립니다.
"""
import json
import os
import shutil
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from transcribe import AUDIO_EXTS, run as transcribe_run  # noqa: E402

INPUT = HERE / "input"
OUTPUT = HERE / "output"
PORT = int(os.environ.get("PORT", 8765))

state = {"busy": False, "log": []}
lock = threading.Lock()


def log(msg):
    with lock:
        state["log"].append(str(msg))
        state["log"] = state["log"][-300:]


def safe_name(name):
    return Path(unquote(name)).name.strip()


def listing():
    ins = sorted(f.name for f in INPUT.iterdir() if f.suffix.lower() in AUDIO_EXTS)
    outs = sorted((f for f in OUTPUT.iterdir() if f.is_file() and not f.name.startswith(".")),
                  key=lambda f: f.stat().st_mtime, reverse=True)
    return ins, [f.name for f in outs]


def check_summary_ready():
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return "요약본에는 anthropic 패키지가 필요해요: pip install anthropic"
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
            or shutil.which("ant")):
        return "요약본에는 Claude API 키가 필요해요 (ANTHROPIC_API_KEY 설정 후 다시 실행)."
    return None


def job(kind, opts):
    try:
        if kind == "transcribe":
            files = [INPUT / safe_name(n) for n in opts.get("files", [])]
            files = [f for f in files if f.exists()]
            if not files:
                log("⚠️ 변환할 파일을 선택하세요.")
                return
            txts = transcribe_run(files, opts.get("model") or "small", "Korean", OUTPUT,
                                  "txt,srt", opts.get("prompt") or None, log=log)
            if opts.get("summary"):
                summarize_all(txts, opts.get("prompt"))
        elif kind == "summarize":
            summarize_all([OUTPUT / safe_name(opts["name"])], opts.get("prompt"))
        log("🎉 완료! 아래 결과 파일 목록에서 내려받으세요.")
    except Exception as e:  # 화면에 오류를 그대로 보여 준다
        log(f"❌ 오류: {e}")
        traceback.print_exc()
    finally:
        state["busy"] = False


def summarize_all(txts, terms):
    problem = check_summary_ready()
    if problem:
        log(f"⚠️ {problem}")
        return
    from summarize import summarize
    for t in txts:
        summarize(t, terms or None, log=log)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/":
            return self.send(200, PAGE, "text/html; charset=utf-8")
        if url.path == "/state":
            ins, outs = listing()
            return self.send(200, json.dumps({"busy": state["busy"], "log": state["log"],
                                              "inputs": ins, "outputs": outs,
                                              "summaryProblem": check_summary_ready()}))
        if url.path.startswith("/output/"):
            f = OUTPUT / safe_name(url.path[len("/output/"):])
            if f.is_file():
                inline = f.suffix in (".txt", ".md", ".srt")
                ctype = "text/plain; charset=utf-8" if inline else "application/octet-stream"
                return self.send(200, f.read_bytes(), ctype)
        self.send(404, '{"error":"not found"}')

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        if url.path == "/upload":
            name = safe_name(parse_qs(url.query).get("name", [""])[0])
            if not name or Path(name).suffix.lower() not in AUDIO_EXTS:
                return self.send(400, '{"error":"지원하지 않는 파일 형식"}')
            with open(INPUT / name, "wb") as out:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        break
                    out.write(chunk)
                    remaining -= len(chunk)
            return self.send(200, json.dumps({"saved": name}))
        if url.path in ("/start", "/summarize"):
            opts = json.loads(self.rfile.read(length) or b"{}")
            if state["busy"]:
                return self.send(409, '{"error":"이미 작업 중입니다"}')
            state["busy"] = True
            state["log"] = []
            kind = "transcribe" if url.path == "/start" else "summarize"
            threading.Thread(target=job, args=(kind, opts), daemon=True).start()
            return self.send(200, '{"ok":true}')
        if url.path == "/open-output":
            open_folder(OUTPUT)
            return self.send(200, '{"ok":true}')
        self.send(404, '{"error":"not found"}')


def open_folder(path):
    if sys.platform == "darwin":
        os.system(f'open "{path}"')
    elif os.name == "nt":
        os.startfile(path)  # type: ignore[attr-defined]
    else:
        os.system(f'xdg-open "{path}" >/dev/null 2>&1 &')


PAGE = r"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>회의 녹음 변환기</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1b;--muted:#6b6a66;--line:#e4e2dc;--accent:#2f5bea;--accent-ink:#fff;--ok:#1f8a4c;--warn:#b25b00}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#ecebe7;--muted:#9c9a94;--line:#33322f;--accent:#6c8cff;--accent-ink:#0d0d0c;--ok:#4cc07f;--warn:#f0a050}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:24px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 22px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px}
.step{font-size:13px;font-weight:700;color:var(--accent);letter-spacing:.02em;margin-bottom:10px}
#drop{border:2px dashed var(--line);border-radius:12px;padding:26px;text-align:center;cursor:pointer;color:var(--muted);transition:.15s}
#drop.over{border-color:var(--accent);color:var(--accent)}
#drop b{color:var(--ink)}
.files{list-style:none;margin:12px 0 0;padding:0}
.files li{display:flex;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--line)}
.files li:first-child{border-top:0}
.files label{flex:1;display:flex;gap:10px;align-items:center;cursor:pointer;word-break:break-all}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px}
.field span{font-size:13px;color:var(--muted)}
select,input[type=text]{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px 10px}
.check{display:flex;gap:8px;align-items:center;margin-top:12px;cursor:pointer}
.hint{font-size:13px;color:var(--warn);margin:6px 0 0}
button{font:inherit;font-weight:600;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:9px 14px;cursor:pointer}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);padding:13px 20px;font-size:16px;width:100%}
button:disabled{opacity:.5;cursor:not-allowed}
button.small{padding:5px 10px;font-size:13px}
#log{background:var(--bg);border-radius:10px;padding:12px;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;max-height:220px;overflow:auto;margin:0;min-height:44px;color:var(--muted)}
.busy{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--ok);margin-right:6px;animation:p 1s infinite}
@keyframes p{50%{opacity:.2}}
.out a{color:var(--accent);text-decoration:none;flex:1;word-break:break-all}
.tag{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--muted)}
.empty{color:var(--muted);font-size:14px;margin:8px 0 0}
</style></head><body><main>
<h1>🎙️ 회의 녹음 변환기</h1>
<p class="sub">녹음을 글(txt)·자막(srt)으로 바꾸고, 요약본까지 만들어요. 글·자막 변환은 내 컴퓨터 안에서만 하고, 요약본만 녹취 글을 Claude에 보내 만들어요.</p>

<section class="card">
  <div class="step">1 · 녹음 파일 올리기</div>
  <div id="drop"><b>여기로 파일을 끌어다 놓거나 클릭</b><br>m4a · mp3 · wav · mp4 · webm 등</div>
  <input id="picker" type="file" multiple accept="audio/*,video/*" hidden>
  <ul class="files" id="inputs"></ul>
</section>

<section class="card">
  <div class="step">2 · 옵션</div>
  <div class="row">
    <label class="field"><span>정확도 (모델)</span>
      <select id="model">
        <option value="base">빠르게 (base)</option>
        <option value="small" selected>보통 · 추천 (small)</option>
        <option value="medium">정확하게 · 느림 (medium)</option>
        <option value="turbo">정확하게 · GPU (turbo)</option>
      </select></label>
    <label class="field" style="flex:2"><span>자주 나오는 용어 (선택)</span>
      <input id="prompt" type="text" placeholder="예: 11번가, PDP, AX TF, 지라"></label>
  </div>
  <label class="check"><input id="summary" type="checkbox" checked> 요약본(회의록)도 함께 만들기</label>
  <p class="hint" id="sumHint" hidden></p>
</section>

<button class="primary" id="go">▶ 변환 시작</button>

<section class="card" style="margin-top:14px">
  <div class="step"><span id="dot"></span>진행 상황</div>
  <pre id="log">대기 중</pre>
</section>

<section class="card">
  <div class="row" style="justify-content:space-between"><div class="step" style="margin:0">3 · 결과 파일</div>
  <button class="small" id="openDir">📂 폴더 열기</button></div>
  <ul class="files out" id="outputs"></ul>
</section>
</main>
<script>
const $=id=>document.getElementById(id);
let busy=false, checked=new Set(), firstLoad=true;
const kind=n=>n.endsWith('-요약.md')?'요약본':n.endsWith('.srt')?'자막':n.endsWith('.txt')?'글':n.split('.').pop();

async function upload(files){
  for(const f of files){
    $('log').textContent=`업로드 중… ${f.name}`;
    const r=await fetch('/upload?name='+encodeURIComponent(f.name),{method:'POST',body:f});
    if(r.ok) checked.add(f.name); else $('log').textContent=`⚠️ ${f.name}: 지원하지 않는 형식`;
  }
  refresh();
}
$('drop').onclick=()=>$('picker').click();
$('picker').onchange=e=>upload(e.target.files);
['dragover','dragenter'].forEach(t=>$('drop').addEventListener(t,e=>{e.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(t=>$('drop').addEventListener(t,e=>{e.preventDefault();$('drop').classList.remove('over')}));
$('drop').addEventListener('drop',e=>upload(e.dataTransfer.files));

async function post(path,body){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  if(!r.ok){const j=await r.json().catch(()=>({}));alert(j.error||'요청 실패')}
  refresh();
}
$('go').onclick=()=>post('/start',{files:[...checked],model:$('model').value,prompt:$('prompt').value,summary:$('summary').checked});
$('openDir').onclick=()=>post('/open-output');

async function refresh(){
  const s=await (await fetch('/state')).json();
  busy=s.busy;
  if(firstLoad){s.inputs.forEach(n=>checked.add(n));firstLoad=false}
  $('inputs').innerHTML=s.inputs.length?s.inputs.map(n=>`<li><label><input type="checkbox" data-n="${encodeURIComponent(n)}" ${checked.has(n)?'checked':''}> ${n}</label></li>`).join(''):'<p class="empty">아직 올린 녹음이 없어요.</p>';
  document.querySelectorAll('#inputs input').forEach(c=>c.onchange=()=>{const n=decodeURIComponent(c.dataset.n);c.checked?checked.add(n):checked.delete(n)});
  $('outputs').innerHTML=s.outputs.length?s.outputs.map(n=>`<li><span class="tag">${kind(n)}</span><a href="/output/${encodeURIComponent(n)}" target="_blank" download>${n}</a>${n.endsWith('.txt')?`<button class="small" data-s="${encodeURIComponent(n)}" ${busy?'disabled':''}>✨ 요약본 만들기</button>`:''}</li>`).join(''):'<p class="empty">변환이 끝나면 여기에 나타나요.</p>';
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>post('/summarize',{name:decodeURIComponent(b.dataset.s),prompt:$('prompt').value}));
  if(s.log.length){$('log').textContent=s.log.join('\n');$('log').scrollTop=1e9}
  $('dot').innerHTML=busy?'<span class="busy"></span>':'';
  $('go').disabled=busy; $('go').textContent=busy?'⏳ 작업 중…':'▶ 변환 시작';
  $('sumHint').hidden=!s.summaryProblem; $('sumHint').textContent=s.summaryProblem||'';
}
refresh(); setInterval(refresh,1500);
</script></body></html>
"""


def main():
    INPUT.mkdir(exist_ok=True)
    OUTPUT.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"회의 녹음 변환기 실행 중 → {url}  (끄려면 Ctrl+C)")
    if not os.environ.get("NO_BROWSER"):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
