import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
const out = "dist";
await rm(out, {recursive:true, force:true});
await mkdir(out, {recursive:true});
for (const item of ["index.html", "assets", "data", "study"]) {
  await cp(item, path.join(out, item), {recursive:true});
}
async function findBanks(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await findBanks(full));
    else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json") {
      const bank = JSON.parse(await readFile(full, "utf8"));
      found.push({
        date: bank.date,
        subject: bank.subject,
        path: path.relative("data", full).split(path.sep).join("/"),
        count: bank.questions.length
      });
    }
  }
  return found;
}
const banks = (await findBanks("data")).sort((a,b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject));
await writeFile(path.join(out, "data", "index.json"), JSON.stringify(banks, null, 2), "utf8");
console.log(`Build complete: ${out}; ${banks.length} question bank(s)`);
