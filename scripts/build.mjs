import { cp, mkdir, rm } from "node:fs/promises";
const out="dist";
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for (const p of ["index.html","assets","data"]) await cp(p,`${out}/${p}`,{recursive:true});
console.log("Build complete:",out);
