import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const input=process.argv[2];
if(!input){console.error("Usage: node scripts/ingest-textbook-text.mjs private-textbook-data/md10.txt");process.exit(1);}
if(!input.endsWith(".txt")){console.error("此入口接受 UTF-8 TXT。扫描 PDF 或逐页 OCR 草稿请运行 python3 scripts/scan-textbook.py --help。");process.exit(1);}
const text=await readFile(input,"utf8");
if(!text.trim()) {console.error("文本为空。");process.exit(1);}
const pages=text.includes("\f")?text.split("\f"):[text];
const chunks=[];
const limit=2500, overlap=180;
for(let pageIdx=0; pageIdx<pages.length; pageIdx++){
  const normalized=pages[pageIdx].replace(/\r/g,"").trim();
  if(!normalized)continue;
  for(let start=0;start<normalized.length;start+=limit-overlap){
    const slice=normalized.slice(start,start+limit).trim();
    if(!slice)continue;
    chunks.push({id:`md10-p${String(pageIdx+1).padStart(4,"0")}-c${String(Math.floor(start/(limit-overlap))+1).padStart(3,"0")}`,pdfPage:pages.length>1?pageIdx+1:null,printedPage:null,text:slice,verified:false});
    if(start+limit>=normalized.length)break;
  }
}
const dir="private-textbook-data"; await mkdir(dir,{recursive:true});
const output=path.join(dir,"md10-chunks.json");
await writeFile(output,JSON.stringify({book:"md10",createdAt:new Date().toISOString(),sourceFilename:path.basename(input),pagesDetected:pages.length,chunks},null,2),"utf8");
console.log(`输出私有分块：${output}；识别页数：${pages.length}；分块数：${chunks.length}。请勿上传到Public仓库。`);
