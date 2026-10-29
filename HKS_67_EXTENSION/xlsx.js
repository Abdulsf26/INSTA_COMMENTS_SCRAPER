/* Tiny OOXML writer. Stored ZIP entries; no remote libraries, macros or formulas. */
(function (root) {
  "use strict";
  const encoder = new TextEncoder(),
    table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  function crc(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function join(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of parts) {
      out.set(p, i);
      i += p.length;
    }
    return out;
  }
  function zip(files) {
    const local = [],
      central = [];
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
      const n = encoder.encode(name),
        b = text instanceof Uint8Array ? text : encoder.encode(text),
        checksum = crc(b);
      const h = new Uint8Array(30),
        v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x800, true);
      v.setUint16(12, 0x21, true);
      v.setUint32(14, checksum, true);
      v.setUint32(18, b.length, true);
      v.setUint32(22, b.length, true);
      v.setUint16(26, n.length, true);
      local.push(h, n, b);
      const c = new Uint8Array(46),
        w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true);
      w.setUint16(4, 20, true);
      w.setUint16(6, 20, true);
      w.setUint16(8, 0x800, true);
      w.setUint16(14, 0x21, true);
      w.setUint32(16, checksum, true);
      w.setUint32(20, b.length, true);
      w.setUint32(24, b.length, true);
      w.setUint16(28, n.length, true);
      w.setUint32(42, offset, true);
      central.push(c, n);
      offset += h.length + n.length + b.length;
    }
    const cd = join(central),
      e = new Uint8Array(22),
      ev = new DataView(e.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, Object.keys(files).length, true);
    ev.setUint16(10, Object.keys(files).length, true);
    ev.setUint32(12, cd.length, true);
    ev.setUint32(16, offset, true);
    return join([...local, cd, e]);
  }
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  function col(n) {
    let s = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  }
  function workbook(job, rows, options = {}) {
    const tv =
      root.TV || (typeof require === "function" ? require("./core.js") : null);
    const warnings = { truncated_cells: 0, cleaned_cells: 0 };
    const analysis =
        root.HKSAnalysis ||
        (typeof require === "function" ? require("./analysis.js") : null),
      clean = analysis.tables(rows),
      a = analysis.analyze(job, rows);
    const comments = clean.comments,
      media = clean.media;
    const tables = [
      {
        name: "Overview",
        columns: [
          "COMMENTS",
          "KNOWN USERNAMES",
          "ROOTS",
          "REPLIES",
          "RECORDED LIKES",
          "MEDIA ASSETS",
          "MISSING MEDIA URLS",
          "REPORTED COUNT",
        ],
        values: [
          [
            rows.length,
            a.stats.authors,
            a.stats.top,
            a.stats.replies,
            a.totalLikes,
            a.stats.assets,
            a.stats.unavailable,
            a.reported,
          ],
          [
            "RETURNED DATA ONLY",
            job.status,
            "EXPORTED / SAVED",
            rows.length + " / " + a.sourceRows,
            "UTC DATES",
            "LIKE COUNTS KNOWN",
            a.knownLikes,
            "HKS_67",
          ],
          ...Array.from({ length: 24 }, () => []),
        ],
      },
      { name: "Comments", ...comments },
      { name: "Media", ...media },
      {
        name: "Coverage",
        columns: ["ITEM", "VALUE"],
        values: [
          ["POST", job.meta.url],
          ["EXPORTED COMMENTS", rows.length],
          ["SAVED COMMENTS", a.sourceRows],
          ["REPORTED COUNT", a.reported ?? "unknown"],
          ["COLLECTION STATUS", job.status],
          [
            "SCOPE",
            a.filtered
              ? "Filtered rows only"
              : "All saved rows; not necessarily all Instagram comments",
          ],
          [
            "MEDIA",
            "URLs can expire. Optional embedding is limited to 20 available thumbnails / GIF stills. Missing photos cannot be reconstructed.",
          ],
          [
            "DATA SAFETY",
            "IDs are text; no macros or formulas. Full URLs are hyperlink targets, not oversized visible cells.",
          ],
          [
            "CELL LIMITS",
            "32,767 UTF-16 units; use JSON for lossless bodies and raw objects.",
          ],
          ["TRUNCATED CELLS", 0],
          ["CLEANED XML-CONTROL CELLS", 0],
          ["EMBEDDED THUMBNAILS", (options.images || []).length],
          [
            "EMBEDDING RESULTS",
            options.mediaNote || "Not requested; local metadata export only.",
          ],
        ],
      },
    ];
    const files = {},
      NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      REL =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    function cell(value, ref, header = false) {
      if (value === null || value === undefined)
        return `<c r="${ref}" s="${header ? 1 : 2}"/>`;
      if (typeof value === "number" && Number.isFinite(value))
        return `<c r="${ref}" s="${header ? 1 : 2}"><v>${value}</v></c>`;
      if (typeof value === "boolean")
        return `<c r="${ref}" s="2" t="b"><v>${value ? 1 : 0}</v></c>`;
      let s = typeof value === "object" ? JSON.stringify(value) : String(value);
      const clean = s.replace(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,
        "",
      );
      if (clean !== s) warnings.cleaned_cells++;
      s = clean;
      if (s.length > 32767) {
        s = s.slice(0, 32720);
        if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
        s += " [Truncated: see JSON]";
        warnings.truncated_cells++;
      }
      return `<c r="${ref}" s="${header ? 1 : 2}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
    }
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (i === 3) {
        t.values[9][1] = warnings.truncated_cells;
        t.values[10][1] = warnings.cleaned_cells;
      }
      const links = [];
      const data = [t.columns, ...t.values]
        .map(
          (row, ri) =>
            `<row r="${ri + 1}" ht="${ri ? (i === 1 ? 66 : 30) : 30}" customHeight="1">${row
              .map((v, ci) => {
                const ref = col(ci) + (ri + 1);
                if (
                  ri &&
                  typeof v === "string" &&
                  /(?:URL)$/.test(t.columns[ci]) &&
                  !/\s/.test(v) &&
                  tv.safeURL(v)
                )
                  links.push({ ref, url: tv.safeURL(v) });
                const shown =
                  ri && links.at(-1)?.ref === ref
                    ? "OPEN " +
                      (t.columns[ci].includes("PROFILE")
                        ? "PROFILE"
                        : t.columns[ci].includes("COMMENT")
                          ? "COMMENT"
                          : "LINK")
                    : v;
                return cell(shown, ref, ri === 0).replace(
                  /s="2"/g,
                  ri % 2 === 0 ? 's="3"' : 's="2"',
                );
              })
              .join("")}</row>`,
        )
        .join("");
      const range = `A1:${col(t.columns.length - 1)}${t.values.length + 1}`;
      const widths = t.columns
        .map(
          (name, ci) =>
            `<col min="${ci + 1}" max="${ci + 1}" width="${/COMMENT$|VALUE/.test(name) ? 64 : /ID|DATE/.test(name) ? 25 : /URL/.test(name) ? 18 : 22}" customWidth="1"/>`,
        )
        .join("");
      files[`xl/worksheets/sheet${i + 1}.xml`] =
        `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${data}</sheetData>${i === 0 ? "" : `<autoFilter ref="${range}"/>`}${links.length ? "<hyperlinks>" + links.map((l, j) => `<hyperlink ref="${l.ref}" r:id="rId${j + 1}"/>`).join("") + "</hyperlinks>" : ""}</worksheet>`;
      if (links.length)
        files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] =
          `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map((l, j) => `<Relationship Id="rId${j + 1}" Type="${REL}/hyperlink" Target="${esc(l.url)}" TargetMode="External"/>`).join("")}</Relationships>`;
    }
    files["[Content_Types].xml"] =
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables.map((t, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
    files["_rels/.rels"] =
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    files["xl/workbook.xml"] =
      `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${tables.map((t, i) => `<sheet name="${esc(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
    files["xl/_rels/workbook.xml.rels"] =
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((t, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${tables.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
    files["xl/styles.xml"] =
      `<?xml version="1.0"?><styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7FF63"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const enhance =
      root.HKSWorkbook ||
      (typeof require === "function" ? require("./workbook-extras.js") : null);
    enhance.enhance(files, {
      tables,
      rows,
      analysis: a,
      images: options.images || [],
    });
    return { bytes: zip(files), ...warnings };
  }
  const api = { workbook };
  if (typeof module !== "undefined") module.exports = api;
  root.TVXLSX = api;
})(globalThis);
