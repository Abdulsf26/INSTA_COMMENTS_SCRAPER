/* Native Excel charts, filterable tables, and optional PNG thumbnails. */
(function (root) {
  "use strict";
  const REL =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
  const DRAW =
    "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
  const e = (v) =>
    String(v ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
      .replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[c],
      );
  const colors = ["A8C8FF", "FFBA9B", "DFEF78", "C8BAED", "A2DCC4"];
  function enhance(files, { tables, rows, analysis, images }) {
    const type = (path, mime) => {
      files["[Content_Types].xml"] = files["[Content_Types].xml"].replace(
        "</Types>",
        `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.${mime}+xml"/></Types>`,
      );
    };
    const relation = (sheet, id, kind, target) => {
      const path = `xl/worksheets/_rels/sheet${sheet}.xml.rels`;
      files[path] ??=
        `<?xml version="1.0"?><Relationships xmlns="${PKG}"></Relationships>`;
      files[path] = files[path].replace(
        "</Relationships>",
        `<Relationship Id="${id}" Type="${REL}/${kind}" Target="${e(target)}"/></Relationships>`,
      );
    };
    const append = (sheet, xml) => {
      const p = `xl/worksheets/sheet${sheet}.xml`;
      files[p] = files[p].replace("</worksheet>", xml + "</worksheet>");
    };
    const col = (n) => {
      let s = "";
      for (n++; n; n = Math.floor((n - 1) / 26))
        s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      return s;
    };
    // Tables remain genuine Excel tables, not just painted cell ranges.
    for (const [index, sheet] of [2, 3].entries()) {
      const t = tables[sheet - 1];
      if (!t.values.length) continue;
      const number = index + 1,
        ref = `A1:${col(t.columns.length - 1)}${t.values.length + 1}`;
      files[`xl/tables/table${number}.xml`] =
        `<?xml version="1.0"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${number}" name="HKS${number}" displayName="HKS${number}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${t.columns.length}">${t.columns.map((n, i) => `<tableColumn id="${i + 1}" name="${e(n)}"/>`).join("")}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
      type(`xl/tables/table${number}.xml`, "spreadsheetml.table");
      relation(sheet, "hksTable", "table", `../tables/table${number}.xml`);
      append(
        sheet,
        '<tableParts count="1"><tablePart r:id="hksTable"/></tableParts>',
      );
    }
    function chart(items, kind, title) {
      const series = `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${e(title)}</c:v></c:tx>${items.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${colors[i % colors.length]}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="171717"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join("")}<c:cat><c:strLit><c:ptCount val="${items.length}"/>${items.map(([n], i) => `<c:pt idx="${i}"><c:v>${e(n)}</c:v></c:pt>`).join("")}</c:strLit></c:cat><c:val><c:numLit><c:formatCode>0</c:formatCode><c:ptCount val="${items.length}"/>${items.map(([, v], i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numLit></c:val></c:ser>`;
      const titleXML = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${e(title)}</a:t></a:r></a:p></c:rich></c:tx></c:title>`;
      const axes =
        '<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="20"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:numFmt formatCode="0" sourceLinked="0"/><c:crossAx val="10"/><c:crosses val="autoZero"/></c:valAx>';
      return `<?xml version="1.0"?><c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${REL}"><c:chart>${titleXML}<c:plotArea><c:layout/>${kind === "pie" ? `<c:pieChart><c:varyColors val="1"/>${series}<c:dLbls><c:showVal val="1"/><c:showPercent val="0"/></c:dLbls></c:pieChart>` : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>${series}<c:dLbls><c:showVal val="1"/></c:dLbls><c:axId val="10"/><c:axId val="20"/></c:barChart>${axes}`}</c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
    }
    const chartItems = [
      Object.entries(analysis.stats.types),
      analysis.topAuthors.map((x) => [x.username, x.rows]),
    ];
    let drawing = "";
    for (let i = 0; i < 2; i++) {
      files[`xl/charts/chart${i + 1}.xml`] = chart(
        chartItems[i],
        i ? "bar" : "pie",
        i ? "Top commenters / returned rows" : "Content mix / returned rows",
      );
      type(`xl/charts/chart${i + 1}.xml`, "drawingml.chart");
      drawing += `<xdr:oneCellAnchor><xdr:from><xdr:col>${i * 4}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="4572000" cy="3429000"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 1}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`;
    }
    files["xl/drawings/drawing1.xml"] =
      `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="${DRAW}" xmlns:a="${A}" xmlns:r="${REL}">${drawing}</xdr:wsDr>`;
    files["xl/drawings/_rels/drawing1.xml.rels"] =
      `<?xml version="1.0"?><Relationships xmlns="${PKG}">${[1, 2].map((i) => `<Relationship Id="rId${i}" Type="${REL}/chart" Target="../charts/chart${i}.xml"/>`).join("")}</Relationships>`;
    type("xl/drawings/drawing1.xml", "drawing");
    relation(1, "hksCharts", "drawing", "../drawings/drawing1.xml");
    append(1, '<drawing r:id="hksCharts"/>');
    const accepted = images
      .slice(0, 20)
      .filter(
        (x) =>
          x.bytes instanceof Uint8Array &&
          x.bytes[0] === 137 &&
          x.bytes[1] === 80 &&
          rows.some((r) => r.comment_id === x.comment_id),
      );
    if (accepted.length) {
      let pictures = "";
      accepted.forEach((image, i) => {
        const row =
          rows.findIndex((r) => r.comment_id === image.comment_id) + 1;
        files[`xl/media/image${i + 1}.png`] = image.bytes;
        // Thumbnails occupy a dedicated appended column; comment text remains untouched.
        pictures += `<xdr:oneCellAnchor><xdr:from><xdr:col>12</xdr:col><xdr:colOff>19050</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from><xdr:ext cx="${image.width * 9525}" cy="${image.height * 9525}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 1}" name="Thumbnail ${i + 1}" descr="Available media still for comment ${e(image.comment_id)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
      });
      files["xl/drawings/drawing2.xml"] =
        `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="${DRAW}" xmlns:a="${A}" xmlns:r="${REL}">${pictures}</xdr:wsDr>`;
      files["xl/drawings/_rels/drawing2.xml.rels"] =
        `<?xml version="1.0"?><Relationships xmlns="${PKG}">${accepted.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/image" Target="../media/image${i + 1}.png"/>`).join("")}</Relationships>`;
      type("xl/drawings/drawing2.xml", "drawing");
      files["[Content_Types].xml"] = files["[Content_Types].xml"].replace(
        "</Types>",
        '<Default Extension="png" ContentType="image/png"/></Types>',
      );
      relation(2, "hksImages", "drawing", "../drawings/drawing2.xml");
      // Drawing precedes tableParts in worksheet schema order.
      files["xl/worksheets/sheet2.xml"] = files["xl/worksheets/sheet2.xml"]
        .replace("<tableParts", '<drawing r:id="hksImages"/><tableParts')
        .replace(/(<dimension ref="A1:)L(\d+"\/>)/, "$1M$2")
        .replace(
          "</row>",
          '<c r="M1" s="1" t="inlineStr"><is><t>THUMBNAIL / STILL</t></is></c></row>',
        )
        .replace(
          "</cols>",
          '<col min="13" max="13" width="24" customWidth="1"/></cols>',
        );
    }
  }
  const api = { enhance };
  if (typeof module !== "undefined") module.exports = api;
  root.HKSWorkbook = api;
})(globalThis);
