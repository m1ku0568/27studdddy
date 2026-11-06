"""Incremental private OCR for the indexed textbook scans. Run with --help."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BOOKS = json.loads((ROOT / "knowledge-base/index.json").read_text(encoding="utf8"))["textbooks"]


def check_source(path, expected_hash):
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected_hash:
        raise ValueError("文件指纹与本目录登记的版本不一致，请检查版本及页码。")


def bounds(value):
    if not re.fullmatch(r"[0-9]+(?:-[0-9]+)?", value):
        raise ValueError("页码应为单页或闭区间，如 27-29")
    parts = list(map(int, value.split("-")))
    if parts[0] > parts[-1]:
        raise ValueError("页码区间倒置")
    return parts[0], parts[-1]


def pages(args, index):
    offset = index["offset"]
    first, last = index["bodyPrinted"]
    if args.chapter is not None:
        if not 1 <= args.chapter <= len(index["chapters"]):
            raise ValueError("章号超出所选教材范围")
        start, end = index["chapters"][args.chapter - 1]["printed"]
        return range(start + offset, end + offset + 1)
    if args.printed:
        start, end = bounds(args.printed)
        if not first <= start <= end <= last:
            raise ValueError(f"印刷页有效范围为 {first}–{last}")
        return range(start + offset, end + offset + 1)
    start, end = bounds(args.pdf_pages or f"1-{index['pdfPageCount']}")
    if not 1 <= start <= end <= index["pdfPageCount"]:
        raise ValueError("PDF 页超出范围")
    return range(start, end + 1)


def usable(text):
    return bool(text.strip()) and not re.fullmatch(r"##\s*PDF页[^\n]*", text.strip())


def reuse(db, args, selected, index):
    check_source(args.archive, index["archiveSha256"])
    rows = []
    with args.archive.open(encoding="utf8") as stream:
        for line in stream:
            row = json.loads(line)
            page = row["pdf_page"]
            if page in selected and usable(row["text"]):
                rows.append((page, row["text"], "archive"))
    with db:
        before = db.total_changes
        db.executemany("INSERT OR IGNORE INTO pages VALUES (?, ?, ?)", rows)
    print(f"新增 OCR 草稿 {db.total_changes-before} 页；选中 {len(selected)} 页")


def ocr(db, args, selected, index):
    check_source(args.pdf, index["scanSha256"])
    with tempfile.TemporaryDirectory() as tmp:
        stem = Path(tmp) / "page"
        for page in selected:
            # Lock before rendering so overlapping invocations do not OCR twice.
            with db:
                db.execute("BEGIN IMMEDIATE")
                exists = db.execute("SELECT 1 FROM pages WHERE pdf=?", (page,)).fetchone()
                if str(page) in index["inspectedNonBodyTextPages"]:
                    continue
                if exists and not args.redo:
                    continue
                languages = subprocess.check_output(["tesseract", "--list-langs"], text=True).splitlines()
                missing = set(args.lang.split("+")) - set(languages)
                if missing:
                    raise ValueError("缺少 OCR 语言包：" + ", ".join(sorted(missing)))
                subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page),
                                "-singlefile", "-r", "300", "-png", str(args.pdf), str(stem)], check=True)
                result = subprocess.run(["tesseract", str(stem.with_suffix(".png")), "stdout",
                                         "-l", args.lang], check=True, stdout=subprocess.PIPE,
                                        encoding="utf8")
                if not usable(result.stdout):
                    raise ValueError(f"PDF {page} 页无有效 OCR 输出；请核对原图")
                db.execute("INSERT OR REPLACE INTO pages VALUES (?, ?, ?)",
                           (page, result.stdout.strip(), "tesseract:" + args.lang))
                print(f"PDF {page} 已保存，待核实", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book", choices=BOOKS, default="md10", help="选择教材，默认 md10")
    commands = parser.add_subparsers(dest="action", required=True)
    reuse_cmd = commands.add_parser("reuse", help="复用所选教材已登记的逐页 OCR 草稿")
    reuse_cmd.add_argument("archive", type=Path)
    scan = commands.add_parser("ocr", help="仅识别选中且缺失的页")
    scan.add_argument("pdf", type=Path)
    scan.add_argument("--lang", default="chi_sim+eng")
    scan.add_argument("--redo", action="store_true", help="明确重做所选页的 OCR 草稿")
    status = commands.add_parser("status")
    search = commands.add_parser("search", help="在私有 OCR 草稿中按字面搜索")
    search.add_argument("query")
    for command in [reuse_cmd, scan, status, search]:
        group = command.add_mutually_exclusive_group(required=command is scan)
        group.add_argument("--chapter", type=int)
        group.add_argument("--printed", help="正文印刷页，如 27 或 27-38")
        group.add_argument("--pdf-pages", help="PDF 阅读器页，如 337")
    args = parser.parse_args()
    book = ROOT / "knowledge-base" / BOOKS[args.book]
    index = json.loads((book / "page-index.json").read_text(encoding="utf8"))
    first, last = index["bodyPrinted"]
    offset = index["offset"]
    selected = pages(args, index)
    database = ROOT / "private-textbook-data" / f"{args.book}.sqlite3"
    database.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(database, timeout=120)
    try:
        db.execute("CREATE TABLE IF NOT EXISTS pages (pdf INTEGER PRIMARY KEY, text TEXT NOT NULL, source TEXT NOT NULL)")
        if args.action == "reuse":
            reuse(db, args, selected, index)
        elif args.action == "ocr":
            ocr(db, args, selected, index)
        else:
            rows = db.execute("SELECT pdf,text,source FROM pages WHERE pdf BETWEEN ? AND ? ORDER BY pdf",
                              (selected.start, selected.stop - 1))
            present = set()
            for page, content, source in rows:
                present.add(page)
                if args.action == "search" and args.query in content:
                    pos = content.index(args.query)
                    printed = page-offset if first <= page-offset <= last else None
                    print(json.dumps(dict(pdfPage=page, printedPage=printed, status="unverified_ocr",
                                          source=source, snippet=content[max(0,pos-28):pos+65]), ensure_ascii=False))
            if args.action == "status":
                print(json.dumps(dict(selected=len(selected), ocrDraftPages=len(present),
                                      classifiedPdfPages=sorted(p for p in selected if str(p) in index["inspectedNonBodyTextPages"]),
                                      missingPdfPages=sorted(p for p in selected if p not in present
                                                             and str(p) not in index["inspectedNonBodyTextPages"]))))
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc))
