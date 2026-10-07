import { formatFileSize } from "../shared/format.ts";
import type { Item, StoredFile } from "../shared/protocol.ts";
import type { Lang, Messages } from "../shared/i18n.ts";
import { previewKind, fileTypeFromName } from "../shared/file-preview.ts";

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function page(lang: Lang, title: string, body: string, script = ""): Response {
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} — share</title><style>
.brand{max-width:48rem;margin:0 auto 1rem;font-size:1.5rem;font-weight:800}.brand span{color:#ea580c}body{font-family:system-ui,sans-serif;background:#faf7f2;color:#292524;margin:0;padding:clamp(1rem,4vw,2rem)}main{max-width:48rem;margin:0 auto;background:white;border:1px solid #e7e5e4;border-radius:1rem;padding:clamp(1rem,4vw,1.5rem)}h1{font-size:1.3rem;margin:0 0 1rem}p{color:#78716c;line-height:1.5}label{display:block}input[type=password],input[type=text]{box-sizing:border-box;width:100%;border:1px solid #d6d3d1;border-radius:.5rem;padding:.75rem;font:inherit;margin:.5rem 0 1rem}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #fed7aa;outline-offset:2px}button,.action{display:inline-block;border:0;border-radius:.5rem;background:#1c1917;color:white;font:inherit;font-size:.9rem;font-weight:600;padding:.6rem .9rem;cursor:pointer;text-decoration:none}button:disabled{opacity:.4;cursor:default}.secondary{background:#f5f5f4;color:#44403c}.toolbar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:1rem 0}.toolbar label{display:flex;gap:.5rem;align-items:center;-webkit-user-select:none;user-select:none}ul{list-style:none;padding:0}li{display:flex;align-items:center;gap:.75rem;border-top:1px solid #f5f5f4;padding:.75rem 0}.file-info{min-width:0;flex:1}.file-name{display:block;overflow-wrap:anywhere}.file-size{font-size:.8rem;color:#78716c}.file-actions{display:flex;flex-wrap:wrap;gap:.5rem}dialog{box-sizing:border-box;max-width:min(56rem,calc(100vw - 2rem));width:100%;max-height:90dvh;border:1px solid #d6d3d1;border-radius:1rem;padding:1rem}dialog::backdrop{background:rgb(28 25 23/.35)}dialog img,dialog video{display:block;max-width:100%;max-height:70dvh;margin:1rem auto}dialog iframe{display:block;width:100%;height:65dvh;border:0;margin-top:1rem}dialog audio{width:100%;margin-top:1rem}[role=alert]{color:#b91c1c}@media(max-width:440px){li{flex-wrap:wrap}.file-actions{margin-left:2rem}}</style></head><body><div class="brand">share<span>.</span></div><main>${body}</main>${script ? `<script>${script}</script>` : ""}</body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; media-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}

export function passwordView(lang: Lang, m: Messages, path: string): Response {
  return page(
    lang,
    m.unlockTitle,
    `<h1>${escapeHtml(m.unlockTitle)}</h1><p>${escapeHtml(m.unlockHint)}</p><form action="${escapeHtml(path)}/unlock" method="post"><label>${escapeHtml(m.sharePassword)}<input name="password" type="password" required minlength="6" maxlength="128" autocomplete="current-password" autofocus></label><button>${escapeHtml(m.unlock)}</button><p role="alert" hidden></p></form>`,
    `const form=document.querySelector('form');form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{Accept:'application/json'}});if(!response.ok)throw Error();location.replace(${scriptJson(path + "?view=1")});}catch{const error=form.querySelector('[role=alert]');error.hidden=false;error.textContent=${scriptJson(m.unlockFailed)};button.disabled=false;}});`,
  );
}

export function fileView(lang: Lang, m: Messages, files: StoredFile[], path: string): Response {
  const rows = files
    .map(
      (f) =>
        `<li><input type="checkbox" value="${f.id}" checked aria-label="${escapeHtml(f.name)}"><div class="file-info"><span class="file-name">${escapeHtml(f.name)}</span><span class="file-size">${formatFileSize(f.size)}</span></div><div class="file-actions">${previewKind(f.type) ? `<button class="secondary" data-preview="${f.id}">${escapeHtml(m.preview)}</button>` : ""}<a class="action" href="${path}/files/${f.id}" download>${escapeHtml(m.download)}</a></div></li>`,
    )
    .join("");
  return page(
    lang,
    m.shareViewTitle,
    `<h1>${files.length} ${escapeHtml(m.filesUnit)}</h1><div class="toolbar"><label><input id="all" type="checkbox" checked>${escapeHtml(m.selectAll)}</label><button id="zip">${escapeHtml(m.downloadZip)}</button><button id="each" class="secondary">${escapeHtml(m.downloadEach)}</button></div><ul>${rows}</ul><dialog><form method="dialog"><button class="secondary">${escapeHtml(m.closePreview)}</button></form><div id="preview"></div></dialog>`,
    `const path=${scriptJson(path)},files=${scriptJson(files)};const boxes=[...document.querySelectorAll('li input')],all=document.querySelector('#all');function selected(){return boxes.filter(b=>b.checked).map(b=>b.value)}function sync(){const ids=selected();all.checked=ids.length===boxes.length;all.indeterminate=ids.length>0&&ids.length<boxes.length;document.querySelector('#zip').disabled=document.querySelector('#each').disabled=!ids.length}all.onchange=()=>{boxes.forEach(b=>b.checked=all.checked);sync()};boxes.forEach(b=>b.onchange=sync);document.querySelector('#zip').onclick=()=>{location.href=path+'/zip?ids='+selected().join(',')};document.querySelector('#each').onclick=()=>{for(const id of selected()){const a=document.createElement('a');a.href=path+'/files/'+id;a.download='';document.body.append(a);a.click();a.remove()}};const dialog=document.querySelector('dialog'),preview=document.querySelector('#preview');document.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>{const file=files.find(f=>f.id===button.dataset.preview);const type=file.type.split(';')[0].toLowerCase();const tag=type.startsWith('image/')?'img':type.startsWith('audio/')?'audio':type.startsWith('video/')?'video':'iframe';const el=document.createElement(tag);el.src=path+'/files/'+file.id+'?preview=1';if(tag==='img')el.alt=file.name;if(tag==='audio'||tag==='video')el.controls=true;if(tag==='iframe'){el.title=file.name;el.setAttribute('sandbox','')}preview.replaceChildren(el);dialog.showModal()});dialog.onclose=()=>preview.replaceChildren();`,
  );
}

export function publicFiles(item: Item): StoredFile[] {
  return (
    item.files ?? [
      {
        id: item.id,
        name: item.fileName ?? "download",
        size: item.fileSize ?? 0,
        type: fileTypeFromName(item.fileName ?? ""),
      },
    ]
  );
}
