"""In-place, layout-preserving PDF text editing via redaction overlay.

pdfminer.six locates each changed text line (position, size, source font).
pikepdf then serialises a copy of the document in which only those lines are
covered with the page background and redrawn at the same baseline using the
PDF's own font. Everything else (images, vectors, untouched text) is left
exactly as-is, so the layout survives 1:1 while QPDF re-writes cleanly.
"""
from __future__ import annotations

import io
import math
import re
from difflib import SequenceMatcher

import pikepdf
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTChar, LTTextContainer, LTTextLine

_FONT_PREFIX = re.compile(r"^[A-Z]{6}\+")

# ponytail: edits are matched line-by-line (same index) against the client's
# original text. Insertions/deletions of whole lines won't place new lines;
# upgrade when someone needs structural re-layout, that's a full typesetter.

def _norm(s: str) -> str:
    return " ".join(s.split())

def _walk(container):
    for el in container:
        if isinstance(el, LTTextLine):
            yield el
        elif isinstance(el, LTTextContainer):
            yield from _walk(el)

def _extract_lines(data: bytes) -> list[dict]:
    """Visual text lines on every page, clustered from positioned fragments.

    pdfminer may split one visual line into several LTTextLine segments
    (per justification group, or even per character). Fragments that share a
    baseline are merged so each entry approximates a real line — the same
    shape the editable textarea exposes.
    """
    clusters: list[dict] = []
    for page_idx, page in enumerate(extract_pages(io.BytesIO(data))):
        frags = []
        for line in _walk(page):
            text = line.get_text().strip()
            if not text:
                continue
            chars = [c for c in line if isinstance(c, LTChar)]
            if not chars:
                continue
            if any(abs(c.matrix[1]) > 1e-3 or abs(c.matrix[2]) > 1e-3 for c in chars):
                continue  # rotated text can't be redrawn in place
            frags.append({
                "x0": min(c.bbox[0] for c in chars),
                "x1": max(c.bbox[1] for c in chars),
                "y0": min(c.bbox[1] for c in chars),
                "y1": max(c.bbox[3] for c in chars),
                "size": max(c.size for c in chars),
                "font": chars[0].fontname,
                "text": text,
            })
        frags.sort(key=lambda f: (-f["y0"], f["x0"]))
        for frag in frags:
            room = next(
                (c for c in clusters
                 if c["page"] == page_idx and abs(c["y0"] - frag["y0"]) < 0.5 * frag["size"]),
                None,
            )
            if room is None:
                clusters.append({
                    "page": page_idx,
                    "x0": frag["x0"], "y0": frag["y0"], "x1": frag["x1"], "y1": frag["y1"],
                    "size": frag["size"], "font": frag["font"],
                    "parts": [(frag["x0"], frag["text"])],
                })
            else:
                room["parts"].append((frag["x0"], frag["text"]))
                room["x0"] = min(room["x0"], frag["x0"])
                room["x1"] = max(room["x1"], frag["x1"])
                room["y0"] = min(room["y0"], frag["y0"])
                room["y1"] = max(room["y1"], frag["y1"])
                room["size"] = max(room["size"], frag["size"])
    lines = []
    for c in clusters:
        parts = sorted(c.pop("parts"))
        lines.append({**c, "text": " ".join(t for _, t in parts)})
    lines.sort(key=lambda l: (l["page"], -l["y0"], l["x0"]))
    return lines

def _font_display_name(obj) -> str:
    try:
        n = obj.BaseFont
        if n:
            return str(n)
    except Exception:
        pass
    try:
        desc = obj.DescendantFonts[0].FontDescriptor.FontName
        return str(desc) if desc else ""
    except Exception:
        return ""

def _pick_font(page, want: str):
    """Reuse one of the page's own fonts for the redraw. Returns (name, obj)."""
    try:
        fonts = dict(page.Resources.Font)
    except Exception:
        fonts = {}
    if not fonts:
        raise ValueError("This page has no usable font resources.")
    want_tail = _FONT_PREFIX.sub("", want)
    best = None
    for key, obj in fonts.items():
        disp = _FONT_PREFIX.sub("", _font_display_name(obj))
        if disp.endswith(want_tail) or want_tail in disp:
            best = (key, obj)
            break
    if best is None:
        key, obj = next(iter(fonts.items()))
        best = (key, obj)
    return best

def _text_operator(obj, text: str) -> str:
    """PDF string token for the drawn text: hex UTF-16BE for CID fonts, else raw."""
    if obj.get("/Type") == pikepdf.Name("/Type0"):
        hexs = text.encode("utf-16-be").hex()
        return f"<{hexs}>"
    try:
        raw = text.encode("cp1252")
    except UnicodeEncodeError:
        raw = text.encode("cp1252", errors="replace")
    escaped = raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
    return f"({escaped.decode('latin-1')})"

def edit_pdf(data: bytes, original: str, edited: str) -> bytes:
    if not original.strip():
        raise ValueError("Original text is empty; nothing to diff.")
    source = _extract_lines(data)
    if not source:
        raise ValueError("No selectable text found. This PDF is scanned/image-only.")

    by_norm: dict[str, list[int]] = {}
    for i, ln in enumerate(source):
        by_norm.setdefault(_norm(ln["text"]), []).append(i)
    used = {k: 0 for k in by_norm}

    # Align changed lines: same index by default, but match on normalized text
    # so extractor whitespace differences (pdfjs vs pdfminer) resolve.
    edits: list[tuple[int, str]] = []
    for oline, eline in zip(original.splitlines(), edited.splitlines()):
        key = _norm(oline)
        newn = _norm(eline)
        if not key or key == newn:
            continue
        cands = by_norm.get(key, [])
        if not cands:
            continue
        idx = cands[used[key]] if used[key] < len(cands) else cands[0]
        used[key] += 1
        edits.append((idx, newn))
    if not edits:
        raise ValueError("No changed text lines matched lines in the PDF.")

    pdf = pikepdf.open(io.BytesIO(data))
    grouped: dict[int, list[tuple[dict, str]]] = {}
    for idx, newn in edits:
        grouped.setdefault(source[idx]["page"], []).append((source[idx], newn))

    for page_idx, items in grouped.items():
        page = pikepdf.Page(pdf.pages[page_idx])
        font_key, font_obj = _pick_font(page, items[0][0]["font"])
        fonts = page.Resources.Font
        fonts[pikepdf.Name("/FEdit")] = font_obj

        ops: list[str] = []
        for ln, newn in items:
            pad = 0.5
            w = (ln["x1"] - ln["x0"]) + 2 * pad
            h = (ln["y1"] - ln["y0"]) + 2 * pad
            x = ln["x0"] - pad
            y = ln["y0"] - pad
            ops.append(f"q\n1 1 1 rg\n{x:.2f} {y:.2f} {w:.2f} {h:.2f} re f\nQ")
        ops.append(f"q\nBT\n/FEdit {items[0][0]['size']:.2f} Tf\n1 0 0 1 0 0 Tm")
        for ln, newn in items:
            tone = _text_operator(font_obj, newn)
            ops.append(f"1 0 0 1 {ln['x0']:.2f} {ln['y0']:.2f} Tm\n{tone} Tj")
        ops.append("ET\nQ")
        page.contents_add("\n".join(ops).encode("latin-1"))

    out = io.BytesIO()
    pdf.save(out)
    return out.getvalue()