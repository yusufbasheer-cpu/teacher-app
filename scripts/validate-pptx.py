"""Strict structural check for a .pptx — the things PowerPoint's "found a problem
with content... repair" dialog is triggered by. Not a full ECMA-376 validator, but it
catches the faults that actually cause repair prompts in generated decks.

Usage: python scripts/validate-pptx.py deck.pptx [more.pptx ...]
Exit code 1 if any deck has problems.
"""
import posixpath
import re
import sys
import zipfile
from collections import Counter

from lxml import etree

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
R_ID = "{%s}id" % NS["r"]
R_EMBED = "{%s}embed" % NS["r"]
R_LINK = "{%s}link" % NS["r"]
# Characters XML 1.0 forbids — PowerPoint refuses to open (or repairs) text containing them.
BAD_XML_CHARS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]")


def rels_path(part):
    d, n = posixpath.split(part)
    return posixpath.join(d, "_rels", n + ".rels")


def validate(path):
    problems = []
    add = problems.append
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile as e:
        return [f"not a valid zip: {e}"]

    names = [i.filename for i in z.infolist()]
    for n, c in Counter(names).items():
        if c > 1:
            add(f"duplicate zip entry: {n}")
    nameset = set(names)
    if "[Content_Types].xml" not in nameset:
        add("missing [Content_Types].xml")
        return problems
    if z.infolist()[0].filename != "[Content_Types].xml":
        add("warn: [Content_Types].xml is not the first zip entry (PowerPoint tolerates)")

    docs = {}
    for n in nameset:
        if n.endswith(".xml") or n.endswith(".rels"):
            raw = z.read(n)
            try:
                docs[n] = etree.fromstring(raw)
            except etree.XMLSyntaxError as e:
                add(f"{n}: XML not well-formed: {e}")
                continue
            if BAD_XML_CHARS.search(raw.decode("utf-8", "replace")):
                add(f"{n}: contains control characters illegal in XML")

    # --- content types: every part needs a default (by extension) or override
    ct = docs.get("[Content_Types].xml")
    if ct is not None:
        defaults = {d.get("Extension", "").lower() for d in ct.findall("ct:Default", NS)}
        overrides = {o.get("PartName") for o in ct.findall("ct:Override", NS)}
        for o in overrides:
            if o.lstrip("/") not in nameset:
                add(f"warn: [Content_Types] override points at missing part {o} (pptxgenjs quirk; PowerPoint tolerates)")
        for n in nameset:
            if n == "[Content_Types].xml" or n.endswith("/"):
                continue
            ext = n.rsplit(".", 1)[-1].lower() if "." in n else ""
            if "/" + n not in overrides and ext not in defaults:
                add(f"no content type for part {n}")

    # --- relationships: targets exist, ids unique
    rel_targets = {}  # part -> {rid: (target_part, mode, type)}
    for rp, root in docs.items():
        if not rp.endswith(".rels"):
            continue
        base = posixpath.dirname(posixpath.dirname(rp))
        src = posixpath.join(base, posixpath.basename(rp)[: -len(".rels")]) if base else posixpath.basename(rp)[: -len(".rels")]
        ids = Counter(r.get("Id") for r in root.findall("rel:Relationship", NS))
        for i, c in ids.items():
            if c > 1:
                add(f"{rp}: duplicate relationship id {i}")
        m = {}
        for r in root.findall("rel:Relationship", NS):
            mode, tgt = r.get("TargetMode"), r.get("Target") or ""
            if mode == "External":
                m[r.get("Id")] = (None, mode, r.get("Type"))
                continue
            full = tgt.lstrip("/") if tgt.startswith("/") else posixpath.normpath(posixpath.join(base, tgt))
            m[r.get("Id")] = (full, mode, r.get("Type"))
            if full not in nameset:
                add(f"{rp}: relationship {r.get('Id')} -> missing part {full}")
        rel_targets[src] = m

    # --- every r:id / r:embed used in a part must exist in that part's rels
    for part, root in docs.items():
        if part.endswith(".rels") or part == "[Content_Types].xml":
            continue
        rels = rel_targets.get(part, {})
        for el in root.iter():
            for attr in (R_ID, R_EMBED, R_LINK):
                v = el.get(attr)
                if v and v not in rels:
                    add(f"{part}: <{etree.QName(el).localname}> uses {attr.split('}')[1]}={v} with no matching relationship")

    # --- presentation.xml: slide ids / master ids
    pres = docs.get("ppt/presentation.xml")
    if pres is not None:
        sld = pres.findall(".//p:sldIdLst/p:sldId", NS)
        for tag, items in (("sldId id", [s.get("id") for s in sld]), ("sldId r:id", [s.get(R_ID) for s in sld])):
            for k, c in Counter(items).items():
                if c > 1:
                    add(f"presentation.xml: duplicate {tag} {k}")
        for s in sld:
            try:
                if not 256 <= int(s.get("id")) < 2147483648:
                    add(f"presentation.xml: sldId id {s.get('id')} out of range 256..2147483647")
            except (TypeError, ValueError):
                add(f"presentation.xml: sldId id not an integer: {s.get('id')}")
        for s in sld:
            tgt = rel_targets.get("ppt/presentation.xml", {}).get(s.get(R_ID))
            if tgt and not (tgt[0] or "").startswith("ppt/slides/slide"):
                add(f"presentation.xml: sldId {s.get('id')} does not point at a slide ({tgt[0]})")
        # Section list (p14:sectionLst): every id must be a real slide, and once a deck has
        # sections every slide must belong to one — otherwise PowerPoint asks to repair.
        p14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
        live_ids = {s.get("id") for s in sld}
        in_sections = []
        for sid in pres.iter("{%s}sldId" % p14):
            in_sections.append(sid.get("id"))
            if sid.get("id") not in live_ids:
                add(f"presentation.xml: section list references deleted slide id {sid.get('id')}")
        if pres.find(".//{%s}sectionLst" % p14) is not None:
            for k in live_ids - set(in_sections):
                add(f"presentation.xml: slide id {k} is not in any section (section list exists)")
            for k, c in Counter(in_sections).items():
                if c > 1:
                    add(f"presentation.xml: slide id {k} appears in more than one section")
        for cs in pres.findall(".//p:custShowLst//p:sldId", NS):
            if cs.get(R_ID) not in {s.get(R_ID) for s in sld}:
                add("presentation.xml: custom show references a removed slide")
        mids = [m.get("id") for m in pres.findall(".//p:sldMasterIdLst/p:sldMasterId", NS)]
        for k, c in Counter(mids).items():
            if c > 1:
                add(f"presentation.xml: duplicate sldMasterId {k}")

    # --- per-slide checks
    layout_ids = set()
    for n, root in docs.items():
        if re.fullmatch(r"ppt/slideMasters/slideMaster\d+\.xml", n):
            for l in root.findall(".//p:sldLayoutIdLst/p:sldLayoutId", NS):
                layout_ids.add(l.get("id"))
    for n, root in sorted(docs.items()):
        if not re.fullmatch(r"ppt/(slides/slide|slideLayouts/slideLayout|slideMasters/slideMaster|notesSlides/notesSlide)\d+\.xml", n):
            continue
        ids = [e.get("id") for e in root.iter() if etree.QName(e).localname == "cNvPr" and e.get("id") is not None]
        for k, c in Counter(ids).items():
            if c > 1:
                add(f"{n}: duplicate shape id {k} (PowerPoint repairs this)")
        # a:tbl must have gridCol + rows with the same number of cells
        for tbl in root.iter("{%s}tbl" % NS["a"]):
            cols = len(tbl.findall("a:tblGrid/a:gridCol", NS))
            if cols == 0:
                add(f"{n}: table without gridCol")
            for tr in tbl.findall("a:tr", NS):
                if len(tr.findall("a:tc", NS)) != cols:
                    add(f"{n}: table row has {len(tr.findall('a:tc', NS))} cells but {cols} columns")
        # txBody must contain at least one paragraph
        for tb in list(root.iter("{%s}txBody" % NS["p"])) + list(root.iter("{%s}txBody" % NS["a"])):
            if tb.find("a:p", NS) is None:
                add(f"{n}: txBody with no paragraph")
        # empty/invalid image extents
        for ext in root.iter("{%s}ext" % NS["a"]):
            if ext.get("cx") is not None and (int(ext.get("cx")) < 0 or int(ext.get("cy")) < 0):
                add(f"{n}: negative shape extent")
        # hyperlink with no target
        for h in root.iter("{%s}hlinkClick" % NS["a"]):
            rid = h.get(R_ID)
            if rid is not None and rid not in rel_targets.get(n, {}):
                add(f"{n}: hyperlink rId {rid} missing")
        if n.startswith("ppt/slides/slide"):
            rels = rel_targets.get(n, {})
            lay = [v for v in rels.values() if v[2] and v[2].endswith("/slideLayout")]
            if len(lay) != 1:
                add(f"{n}: must have exactly one slideLayout relationship, has {len(lay)}")
            notes = [v for v in rels.values() if v[2] and v[2].endswith("/notesSlide")]
            if len(notes) > 1:
                add(f"{n}: has {len(notes)} notesSlide relationships")

    # --- each slide part should be used by exactly one sldId; each layout belongs to a master
    if pres is not None:
        used = Counter()
        for s in pres.findall(".//p:sldIdLst/p:sldId", NS):
            t = rel_targets.get("ppt/presentation.xml", {}).get(s.get(R_ID))
            if t:
                used[t[0]] += 1
        for k, c in used.items():
            if c > 1:
                add(f"slide part {k} is listed {c} times in sldIdLst")
        for n in nameset:
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", n) and n not in used:
                add(f"orphan slide part {n} (in package but not in sldIdLst)")
    for n in nameset:
        if re.fullmatch(r"ppt/slideLayouts/slideLayout\d+\.xml", n):
            owners = [m for m, rs in rel_targets.items() if m.startswith("ppt/slideMasters/") and any(v[0] == n for v in rs.values())]
            if not owners:
                add(f"{n} is not referenced by any slide master")
    return problems


if __name__ == "__main__":
    bad = 0
    for f in sys.argv[1:]:
        p = validate(f)
        errors = [x for x in p if not x.startswith("warn:")]
        print(("FAIL " if errors else "ok   ") + f)
        for x in sorted(p, key=lambda x: x.startswith("warn:"))[:25]:
            print("     -", x)
        if len(p) > 25:
            print(f"     ... and {len(p) - 25} more")
        bad += bool(errors)
    sys.exit(1 if bad else 0)
