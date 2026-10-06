/* Moteur de rendu des badges.
   Une seule routine de dessin (drawBadge) alimente deux "peintres" :
   - SvgPainter : apercu a l'ecran
   - PdfPainter : PDF vectoriel, en CMJN (DeviceCMYK) ou RVB
   Toutes les coordonnees sont en millimetres, origine en haut a gauche. */
(function () {
  'use strict';

  const PT_PER_MM = 72 / 25.4;
  const ART = window.BADGE_ART;

  /* ---------- Polices ---------- */
  const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const FONT_BYTES = {};
  const FK = {};
  for (const key of Object.keys(window.BADGE_FONTS)) {
    FONT_BYTES[key] = b64ToBytes(window.BADGE_FONTS[key]);
    FK[key] = fontkit.create(FONT_BYTES[key]);
  }
  // Correspondance police -> famille CSS (enregistree par app.js via FontFace)
  const CSS_FONT = {
    sans600: { family: 'Badge Sans', weight: 600, style: 'normal' },
    sans400: { family: 'Badge Sans', weight: 400, style: 'normal' },
    sans700: { family: 'Badge Sans', weight: 700, style: 'normal' },
    role300i: { family: 'Badge Serif', weight: 300, style: 'italic' },
    role600i: { family: 'Badge Serif', weight: 600, style: 'italic' },
  };

  const widthCache = new Map();
  /** Largeur d'un texte en mm, calculee comme pdf-lib (somme des avances, ligatures comprises). */
  function textWidthMm(fontKey, text, sizePt) {
    const ck = fontKey + '|' + text;
    let units = widthCache.get(ck);
    if (units === undefined) {
      const f = FK[fontKey];
      const run = f.layout(text);
      units = 0;
      for (const g of run.glyphs) units += g.advanceWidth;
      units /= f.unitsPerEm;
      if (widthCache.size > 4000) widthCache.clear();
      widthCache.set(ck, units);
    }
    return (units * sizePt) / PT_PER_MM;
  }

  function missingGlyphs(fontKey, text) {
    const f = FK[fontKey];
    const out = new Set();
    for (const ch of text) {
      if (/\s/.test(ch)) continue;
      if (!f.hasGlyphForCodePoint(ch.codePointAt(0))) out.add(ch);
    }
    return [...out];
  }

  /* ---------- Couleurs ---------- */
  // Approximation CMJN -> RVB (polynome de pdf.js, profil type SWOP) pour l'apercu ecran.
  function cmykToRgb(c, m, y, k) {
    const r = 255 + c * (-4.387332384609988 * c + 54.48615194189176 * m + 18.82290502165302 * y + 212.25662451639585 * k - 285.2331026137004) + m * (1.7149763477362134 * m - 5.6096736904047315 * y - 17.873870861415444 * k - 5.497006427196366) + y * (-2.5217340131683033 * y - 21.248923337353073 * k + 17.5119270841813) + k * (-21.86122147463605 * k - 189.48180835922747);
    const g = 255 + c * (8.841041422036149 * c + 60.118027045597366 * m + 6.871425592049007 * y + 31.159100130055922 * k - 79.2970844816548) + m * (-15.310361306967817 * m + 17.575251261109482 * y + 131.35250912493976 * k - 190.9453302588951) + y * (4.444339102852739 * y + 9.8632861493405 * k - 24.86741582555878) + k * (-20.737325471181034 * k - 187.80453709719578);
    const b = 255 + c * (0.8842522430003296 * c + 8.078677503112928 * m + 30.89978309703729 * y - 0.23883238689178934 * k - 14.183576799673286) + m * (10.49593273432072 * m + 63.02378494754052 * y + 50.606957656360734 * k - 112.23884253719248) + y * (0.03296041114873217 * y + 115.60384449646641 * k - 193.58209356861505) + k * (-22.33816807309886 * k - 180.12613974708367);
    return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))));
  }

  /** Couleur = { cmyk:[0..1 x4], rgb:[0..255 x3] }. Le rvb "exact" des couleurs d'origine provient du rendu Acrobat. */
  function color(cmyk, rgb) {
    return { cmyk: cmyk.slice(), rgb: rgb ? rgb.slice() : cmykToRgb(...cmyk) };
  }
  const C = {
    navy: color([0.973, 0.887, 0.359, 0.348], [30, 42, 84]),
    navyLight: color([0.906, 0.816, 0.23, 0.309], [42, 54, 102]),
    blue: color([1, 1, 0, 0], [46, 48, 146]),
    magenta: color([0, 1, 0, 0], [236, 0, 140]),
    white: color([0, 0, 0, 0], [255, 255, 255]),
    black: color([0, 0, 0, 1], [35, 31, 32]),
  };
  const sameCmyk = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.0005);
  /** Retrouve le rvb de reference si la couleur correspond a une couleur d'origine. */
  function colorFromCmyk(cmyk) {
    for (const k of Object.keys(C)) if (sameCmyk(C[k].cmyk, cmyk)) return color(cmyk, C[k].rgb);
    return color(cmyk);
  }
  const rgbCss = (col) => `rgb(${col.rgb[0]} ${col.rgb[1]} ${col.rgb[2]})`;

  /* ---------- Geometrie des badges ---------- */
  const FORMATS = {
    '85x53': { w: 85, h: 53, label: '85 × 53 mm', hint: 'Format de vos badges 2026' },
    '86x54': { w: 85.6, h: 54, label: '85,6 × 54 mm', hint: 'Carte CR80, imprimantes à badges PVC' },
    '90x55': { w: 90, h: 55, label: '90 × 55 mm', hint: 'Format carte de visite' },
  };
  const IMAGE_BLEED = 2; // les images sont toujours preparees pour couvrir 2 mm de fond perdu

  // Mise en page de reference (mesuree sur le fichier Illustrator, badge 85 x 53).
  // Les tailles sont recalees pour que les hauteurs de capitale correspondent aux polices d'origine.
  const REF = {
    marginX: 4.0,
    first: { size: 37.3, y: 17.36 },
    last: { size: 30.3, y: 30.91 },
    role: { size: 21, y: 48.09, right: 82.3 },
  };

  function layoutText(person, role, W, H) {
    const sx = W / 85, sy = H / 53, ss = Math.min(sx, sy);
    const L = Object.assign({ nameScale: 1, roleScale: 1, align: 'left', nameFont: 'sans600', lastUpper: true, labelAlign: 'right', offsetY: 0 }, role.layout || {});
    const left = REF.marginX * sx;
    const maxW = W - 2 * REF.marginX * sx;
    const nameX = L.align === 'center' ? W / 2 : L.align === 'right' ? W - left : left;
    const nameAnchor = L.align === 'center' ? 'middle' : L.align === 'right' ? 'end' : 'start';
    const first = (person.first || '').trim();
    const last = L.lastUpper ? (person.last || '').trim().toLocaleUpperCase('fr-FR') : (person.last || '').trim();
    const label = roleLabel(person, role);
    const roleFont = role.roleWeight === 600 ? 'role600i' : 'role300i';
    const fit = (fontKey, text, base) => {
      if (!text) return { size: base, shrink: 1, width: 0 };
      const w = textWidthMm(fontKey, text, base);
      const shrink = w > maxW ? maxW / w : 1;
      return { size: base * shrink, shrink, width: w * shrink };
    };
    const NF = L.nameFont;
    const lastBase = REF.last.size * ss * L.nameScale;
    const f1 = fit(NF, first, REF.first.size * ss * L.nameScale);
    const f3 = fit(roleFont, label, REF.role.size * ss * L.roleScale);
    let lastLines = [last], lastSize, lastShrink;
    {
      const f2 = fit(NF, last, lastBase);
      lastSize = f2.size; lastShrink = f2.shrink;
      // Nom tres long : passage sur deux lignes (coupure a l'espace ou au trait d'union le plus equilibre)
      if (f2.shrink < 0.72) {
        let best = null;
        for (let i = 1; i < last.length - 1; i++) {
          const ch = last[i];
          if (ch !== ' ' && ch !== '-') continue;
          const a = last.slice(0, ch === '-' ? i + 1 : i).trim(), b = last.slice(i + 1).trim();
          if (!a || !b) continue;
          const w = Math.max(textWidthMm(NF, a, 1), textWidthMm(NF, b, 1));
          if (!best || w < best.w) best = { a, b, w };
        }
        if (best) {
          const size = Math.min(lastBase * 0.8, maxW / best.w);
          if (size / lastBase > f2.shrink) { lastLines = [best.a, best.b]; lastSize = size; lastShrink = size / lastBase; }
        }
      }
    }
    // Taille agrandie : le nom descend un peu pour garder l'interligne d'origine
    const dy = L.offsetY * sy, grow = (L.nameScale - 1) * 12 * sy;
    const lastY = (REF.last.y - (lastLines.length > 1 ? 2 : 0)) * sy + grow + dy, lineGap = (lastSize / PT_PER_MM) * 0.98;
    const roleX = L.labelAlign === 'left' ? left : L.labelAlign === 'center' ? W / 2 : REF.role.right * sx;
    const roleAnchor = L.labelAlign === 'left' ? 'start' : L.labelAlign === 'center' ? 'middle' : 'end';
    return {
      items: [
        { text: first, font: NF, size: f1.size, x: nameX, y: REF.first.y * sy + grow * 0.35 + dy, anchor: nameAnchor },
        ...lastLines.map((t, i) => ({ text: t, font: NF, size: lastSize, x: nameX, y: lastY + i * lineGap, anchor: nameAnchor })),
        { text: label, font: roleFont, size: f3.size, x: roleX, y: REF.role.y * sy, anchor: roleAnchor },
      ],
      roleFont, roleText: label,
      shrink: Math.min(f1.shrink, lastShrink, f3.shrink),
    };
  }

  function roleLabel(person, role) {
    if (person.label && person.label.trim()) return person.label.trim();
    return person.gender === 'f' ? role.labelF : role.labelM;
  }

  function personIssues(person, role) {
    const issues = [];
    if (!(person.first || '').trim() && !(person.last || '').trim()) issues.push({ kind: 'empty', text: 'Nom manquant' });
    const lay = layoutText(person, role, 85, 53);
    if (lay.shrink < 0.8) issues.push({ kind: 'shrink', text: 'Texte réduit à ' + Math.round(lay.shrink * 100) + ' %' });
    const miss = [...new Set([...missingGlyphs('sans600', (person.first || '') + (person.last || '').toLocaleUpperCase('fr-FR')), ...missingGlyphs(lay.roleFont, lay.roleText)])];
    if (miss.length) issues.push({ kind: 'glyph', text: 'Caractère non pris en charge : ' + miss.join(' ') });
    return issues;
  }

  /* ---------- Dessin d'un badge (commun SVG / PDF) ---------- */
  function drawArt(p, x, y, W, H, bleed, motif, opt = {}) {
    if (opt.flipX || opt.flipY) {
      p.save();
      p.transform(opt.flipX ? -1 : 1, 0, 0, opt.flipY ? -1 : 1, opt.flipX ? 2 * x + W : 0, opt.flipY ? 2 * y + H : 0);
      drawArt(p, x, y, W, H, bleed, motif, { ...opt, flipX: false, flipY: false });
      p.restore();
      return;
    }
    const s = Math.max(W / ART.width, H / ART.height);
    const tx = x + (W - ART.width * s) / 2;
    const ty = y + (H - ART.height * s) / 2;
    const regions = [];
    if (bleed > 0) {
      // Fond perdu : le motif est reflechi de l'autre cote du trait de coupe -> continuite parfaite.
      // Sous-couche : copie du motif agrandie de 0,2 mm par cote. Elle bouche la jonction
      // entre le badge et les zones reflechies (sinon un liseré d'anticrenelage apparait a l'ecran).
      const kx = (W + 0.4) / W, ky = (H + 0.4) / H, cx = x + W / 2, cy = y + H / 2;
      const b = bleed, R = x + W, B = y + H;
      regions.push(
        [x - b, y - b, W + 2 * b, H + 2 * b, kx, cx * (1 - kx), ky, cy * (1 - ky)],
        [x, y - b, W, b, 1, 0, -1, 2 * y],
        [x, B, W, b, 1, 0, -1, 2 * B],
        [x - b, y, b, H, -1, 2 * x, 1, 0],
        [R, y, b, H, -1, 2 * R, 1, 0],
        [x - b, y - b, b, b, -1, 2 * x, -1, 2 * y],
        [R, y - b, b, b, -1, 2 * R, -1, 2 * y],
        [x - b, B, b, b, -1, 2 * x, -1, 2 * B],
        [R, B, b, b, -1, 2 * R, -1, 2 * B]
      );
    }
    regions.push([x, y, W, H, 1, 0, 1, 0]);
    for (const [rx, ry, rw, rh, a, e, d, f] of regions) {
      p.save();
      p.clipRect(rx, ry, rw, rh);
      if (a !== 1 || d !== 1) p.transform(a, 0, 0, d, e, f);
      p.transform(s, 0, 0, s, tx, ty);
      if (opt.waves !== false) p.fillArt('waves', motif);
      if (opt.octopus !== false) p.fillArt('octopus', motif);
      p.restore();
    }
  }

  /**
   * opts: { x, y, W, H, bleed, person, role, image }
   * role: { bg:{ mode:'pattern'|'solid'|'image', base, motif, veil, motifOnImage }, text, roleWeight, labelM, labelF }
   * image: { key, preview, ... } prepare par l'appelant (null si aucune).
   */
  function drawBadge(p, o) {
    const { x, y, W, H, bleed, person, role, image } = o;
    const bg = role.bg;
    const bx = x - bleed, by = y - bleed, bw = W + 2 * bleed, bh = H + 2 * bleed;
    p.save();
    p.clipRect(bx, by, bw, bh);
    p.fillRect(bx, by, bw, bh, bg.base);
    if (bg.mode === 'image' && image) {
      p.image(image, x - IMAGE_BLEED, y - IMAGE_BLEED, W + 2 * IMAGE_BLEED, H + 2 * IMAGE_BLEED);
      if (bg.veil > 0) p.fillRect(bx, by, bw, bh, C.navy, bg.veil);
      if (bg.motifOnImage) drawArt(p, x, y, W, H, bleed, bg.motif, bg);
    } else if (bg.mode === 'pattern') {
      drawArt(p, x, y, W, H, bleed, bg.motif, bg);
    }
    // Bandeau de couleur en bas du badge (déborde dans le fond perdu)
    if (role.band) p.fillRect(bx, y + H - role.band.h, bw, role.band.h + bleed, role.band.color);
    p.restore();

    const lay = layoutText(person, role, W, H);
    const ink = role.ink || (role.text === 'navy' ? C.navy : C.white);
    for (const t of lay.items) {
      if (t.text) p.text(t.text, x + t.x, y + t.y, t.font, t.size, ink, t.anchor);
    }
    return lay;
  }

  /* ---------- Planches ---------- */
  const A4 = { w: 210, h: 297 };
  const GUTTER_X = 10, GUTTER_Y = 8, COLS = 2, ROWS = 4;
  const MARK_LEN = 5, MARK_W = 0.1;

  function sheetGeometry(fmt) {
    const gw = COLS * fmt.w + (COLS - 1) * GUTTER_X;
    const gh = ROWS * fmt.h + (ROWS - 1) * GUTTER_Y;
    const x0 = (A4.w - gw) / 2, y0 = (A4.h - gh) / 2;
    const slots = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) slots.push({ x: x0 + c * (fmt.w + GUTTER_X), y: y0 + r * (fmt.h + GUTTER_Y) });
    return { x0, y0, gw, gh, slots, perPage: COLS * ROWS };
  }

  function drawCropMarksSheet(p, g, fmt, bleed) {
    const off = bleed + 1;
    const xs = [], ys = [];
    for (let c = 0; c < COLS; c++) { const x = g.x0 + c * (fmt.w + GUTTER_X); xs.push(x, x + fmt.w); }
    for (let r = 0; r < ROWS; r++) { const y = g.y0 + r * (fmt.h + GUTTER_Y); ys.push(y, y + fmt.h); }
    const top = g.y0, bottom = g.y0 + g.gh, left = g.x0, right = g.x0 + g.gw;
    for (const x of xs) {
      p.line(x, top - off - MARK_LEN, x, top - off, MARK_W, C.black);
      p.line(x, bottom + off, x, bottom + off + MARK_LEN, MARK_W, C.black);
    }
    for (const y of ys) {
      p.line(left - off - MARK_LEN, y, left - off, y, MARK_W, C.black);
      p.line(right + off, y, right + off + MARK_LEN, y, MARK_W, C.black);
    }
  }

  function drawCropMarksSingle(p, x, y, W, H, bleed) {
    const off = bleed + 1;
    for (const cx of [x, x + W]) {
      p.line(cx, y - off - MARK_LEN, cx, y - off, MARK_W, C.black);
      p.line(cx, y + H + off, cx, y + H + off + MARK_LEN, MARK_W, C.black);
    }
    for (const cy of [y, y + H]) {
      p.line(x - off - MARK_LEN, cy, x - off, cy, MARK_W, C.black);
      p.line(x + W + off, cy, x + W + off + MARK_LEN, cy, MARK_W, C.black);
    }
  }

  function singleGeometry(fmt, print) {
    const bleed = print.bleed ? 2 : 0;
    const margin = print.cropMarks ? bleed + 1 + MARK_LEN + 1 : bleed;
    return { pw: fmt.w + 2 * margin, ph: fmt.h + 2 * margin, x: margin, y: margin, bleed };
  }

  /** Decoupe la liste de badges en pages selon la disposition. */
  function paginate(items, print) {
    const fmt = FORMATS[print.format];
    if (print.layout === 'single') return items.map((it) => [it]);
    const per = sheetGeometry(fmt).perPage;
    const pages = [];
    for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
    return pages;
  }

  function drawPage(p, pageItems, print, ctx) {
    const fmt = FORMATS[print.format];
    const bleed = print.bleed ? 2 : 0;
    if (print.layout === 'single') {
      const g = singleGeometry(fmt, print);
      const it = pageItems[0];
      drawBadge(p, { x: g.x, y: g.y, W: fmt.w, H: fmt.h, bleed, person: it.person, role: it.role, image: ctx.imageFor(it) });
      if (print.cropMarks) drawCropMarksSingle(p, g.x, g.y, fmt.w, fmt.h, bleed);
      return;
    }
    const g = sheetGeometry(fmt);
    pageItems.forEach((it, i) => {
      const s = g.slots[i];
      drawBadge(p, { x: s.x, y: s.y, W: fmt.w, H: fmt.h, bleed, person: it.person, role: it.role, image: ctx.imageFor(it) });
    });
    if (print.cropMarks) drawCropMarksSheet(p, g, fmt, bleed);
    if (ctx.slug) p.text(ctx.slug, g.x0, A4.h - 8, 'sans400', 6.5, C.black, 'start');
  }

  function pageSize(print) {
    if (print.layout === 'single') { const g = singleGeometry(FORMATS[print.format], print); return { w: g.pw, h: g.ph }; }
    return { w: A4.w, h: A4.h };
  }

  /* ---------- Peintre SVG ---------- */
  let svgUid = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v) => +v.toFixed(3);

  class SvgPainter {
    constructor() { this.out = []; this.defs = []; this.stack = []; }
    save() { this.stack.push(0); }
    restore() { const k = this.stack.pop() || 0; for (let i = 0; i < k; i++) this.out.push('</g>'); }
    open(tag) { this.out.push(tag); if (this.stack.length) this.stack[this.stack.length - 1]++; }
    clipRect(x, y, w, h) {
      const id = 'bc' + (++svgUid);
      this.defs.push(`<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`);
      this.open(`<g clip-path="url(#${id})">`);
    }
    transform(a, b, c, d, e, f) { this.open(`<g transform="matrix(${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)})">`); }
    fillRect(x, y, w, h, col, opacity = 1) {
      this.out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${rgbCss(col)}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`);
    }
    fillArt(key, col) { this.out.push(`<use href="#badge-art-${key}" fill="${rgbCss(col)}"/>`); }
    image(img, x, y, w, h) { this.out.push(`<image href="${img.preview}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"/>`); }
    line(x1, y1, x2, y2, w, col) { this.out.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${rgbCss(col)}" stroke-width="${w}"/>`); }
    text(str, x, y, fontKey, sizePt, col, anchor) {
      const f = CSS_FONT[fontKey];
      this.out.push(`<text x="${n(x)}" y="${n(y)}" font-family="${f.family}" font-weight="${f.weight}" font-style="${f.style}" font-size="${n(sizePt / PT_PER_MM)}" fill="${rgbCss(col)}" text-anchor="${anchor}">${esc(str)}</text>`);
    }
    svg(vx, vy, vw, vh, attrs = '') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}" ${attrs}><defs>${this.defs.join('')}</defs>${this.out.join('')}</svg>`;
    }
  }

  /** Bibliotheque SVG partagee (a inserer une fois dans la page) : les motifs sont references par <use>. */
  function svgArtLibrary() {
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><path id="badge-art-waves" d="${ART.waves}"/><path id="badge-art-octopus" d="${ART.octopus}"/></defs></svg>`;
  }

  function badgeSvg(person, role, image, fmtKey = '85x53', attrs = '') {
    const fmt = FORMATS[fmtKey];
    const p = new SvgPainter();
    const lay = drawBadge(p, { x: 0, y: 0, W: fmt.w, H: fmt.h, bleed: 0, person, role, image });
    return { svg: p.svg(0, 0, fmt.w, fmt.h, attrs), layout: lay };
  }

  function pageSvg(pageItems, print, ctx, attrs = '') {
    const size = pageSize(print);
    const p = new SvgPainter();
    p.fillRect(0, 0, size.w, size.h, C.white);
    drawPage(p, pageItems, print, ctx);
    return p.svg(0, 0, size.w, size.h, attrs);
  }

  /* ---------- Peintre PDF ---------- */
  function svgPathToPdf(d) {
    const ops = [];
    let cx = 0, cy = 0;
    const re = /([MLCHVZ])([^MLCHVZ]*)/g;
    let m;
    while ((m = re.exec(d))) {
      const a = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
      switch (m[1]) {
        case 'M': [cx, cy] = a; ops.push(`${cx} ${cy} m`); break;
        case 'L': [cx, cy] = a; ops.push(`${cx} ${cy} l`); break;
        case 'H': cx = a[0]; ops.push(`${cx} ${cy} l`); break;
        case 'V': cy = a[0]; ops.push(`${cx} ${cy} l`); break;
        case 'C': ops.push(`${a.join(' ')} c`); cx = a[4]; cy = a[5]; break;
        case 'Z': ops.push('h'); break;
      }
    }
    return ops.join('\n');
  }
  const ART_PDF = { waves: svgPathToPdf(ART.waves), octopus: svgPathToPdf(ART.octopus) };

  class PdfPainter {
    constructor(res, colorMode) { this.ops = []; this.res = res; this.mode = colorMode; }
    fillOp(col) {
      if (this.mode === 'cmyk') return `${col.cmyk.map(n).join(' ')} k`;
      return `${col.rgb.map((v) => n(v / 255)).join(' ')} rg`;
    }
    strokeOp(col) {
      if (this.mode === 'cmyk') return `${col.cmyk.map(n).join(' ')} K`;
      return `${col.rgb.map((v) => n(v / 255)).join(' ')} RG`;
    }
    save() { this.ops.push('q'); }
    restore() { this.ops.push('Q'); }
    clipRect(x, y, w, h) { this.ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re W n`); }
    transform(a, b, c, d, e, f) { this.ops.push(`${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} cm`); }
    fillRect(x, y, w, h, col, opacity = 1) {
      if (opacity < 1) this.ops.push('q', `${this.res.gs(opacity)} gs`);
      this.ops.push(this.fillOp(col), `${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`);
      if (opacity < 1) this.ops.push('Q');
    }
    fillArt(key, col) { this.ops.push(this.fillOp(col), ART_PDF[key], 'f'); }
    image(img, x, y, w, h) { this.ops.push('q', `${n(w)} 0 0 ${n(-h)} ${n(x)} ${n(y + h)} cm`, `${this.res.image(img)} Do`, 'Q'); }
    line(x1, y1, x2, y2, w, col) { this.ops.push(`${n(w)} w`, this.strokeOp(col), `${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`); }
    text(str, x, y, fontKey, sizePt, col, anchor) {
      const size = sizePt / PT_PER_MM;
      const tx = anchor === 'end' ? x - textWidthMm(fontKey, str, sizePt) : anchor === 'middle' ? x - textWidthMm(fontKey, str, sizePt) / 2 : x;
      const font = this.res.font(fontKey);
      this.ops.push('BT', this.fillOp(col), `${font.name} 1 Tf`, `${n(size)} 0 0 ${n(-size)} ${n(tx)} ${n(y)} Tm`, `${font.pdf.encodeText(str).toString()} Tj`, 'ET');
    }
  }

  function rgbToCmykBytes(rgba) {
    const out = new Uint8Array((rgba.length / 4) * 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 4) {
      const r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255;
      const k = 1 - Math.max(r, g, b);
      if (k >= 0.9999) { out[j + 3] = 255; continue; }
      const inv = 1 / (1 - k);
      out[j] = Math.round((1 - r - k) * inv * 255);
      out[j + 1] = Math.round((1 - g - k) * inv * 255);
      out[j + 2] = Math.round((1 - b - k) * inv * 255);
      out[j + 3] = Math.round(k * 255);
    }
    return out;
  }

  /**
   * Genere le PDF.
   * items : [{ person, role, imageKey }] dans l'ordre d'impression
   * images : { [key]: { preview, canvas } }
   */
  async function buildPdf(items, print, images, meta) {
    const { PDFDocument, PDFName } = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle(meta.title);
    doc.setAuthor(meta.author);
    doc.setCreator('Badges Handiplage');
    doc.setProducer('Badges Handiplage (pdf-lib)');

    const fontCache = {};
    const getFont = async (key) => (fontCache[key] ||= await doc.embedFont(FONT_BYTES[key], { subset: true }));
    // Pre-chargement des polices utilisees
    const needed = new Set(['sans600', 'sans400']);
    for (const it of items) needed.add(it.role.roleWeight === 600 ? 'role600i' : 'role300i');
    for (const k of needed) await getFont(k);

    const imgRefs = {};
    for (const key of new Set(items.map((it) => it.imageKey).filter(Boolean))) {
      const im = images[key];
      if (!im) continue;
      if (print.colorMode === 'cmyk') {
        const cv = im.canvas;
        const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const stream = doc.context.flateStream(rgbToCmykBytes(data), {
          Type: 'XObject', Subtype: 'Image', Width: cv.width, Height: cv.height, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8,
        });
        imgRefs[key] = doc.context.register(stream);
      } else {
        const jpg = await (await fetch(im.canvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
        imgRefs[key] = (await doc.embedJpg(jpg)).ref;
      }
    }

    const fmt = FORMATS[print.format];
    const pages = paginate(items, print);
    const size = pageSize(print);
    const gsCache = {};

    pages.forEach((pageItems, idx) => {
      const page = doc.addPage([size.w * PT_PER_MM, size.h * PT_PER_MM]);
      const node = page.node;
      const names = { font: {}, image: {}, gs: {} };
      const res = {
        font: (key) => {
          if (!names.font[key]) names.font[key] = node.newFontDictionary('F', fontCache[key].ref).toString();
          return { name: names.font[key], pdf: fontCache[key] };
        },
        image: (img) => {
          if (!names.image[img.key]) names.image[img.key] = node.newXObject('Im', imgRefs[img.key]).toString();
          return names.image[img.key];
        },
        gs: (alpha) => {
          const k = alpha.toFixed(3);
          if (!gsCache[k]) gsCache[k] = doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: +k, CA: +k }));
          if (!names.gs[k]) names.gs[k] = node.newExtGState('GS', gsCache[k]).toString();
          return names.gs[k];
        },
      };
      const p = new PdfPainter(res, print.colorMode);
      p.transform(PT_PER_MM, 0, 0, -PT_PER_MM, 0, size.h * PT_PER_MM);
      const slug = print.layout === 'sheet'
        ? `${meta.title}  ·  planche ${idx + 1}/${pages.length}  ·  ${fmt.label}${print.bleed ? '  ·  fond perdu 2 mm' : ''}  ·  ${print.colorMode === 'cmyk' ? 'CMJN' : 'RVB'}  ·  imprimer à 100 %`
        : null;
      drawPage(p, pageItems, print, { imageFor: (it) => (it.imageKey && imgRefs[it.imageKey] ? { key: it.imageKey } : null), slug });
      const stream = doc.context.flateStream(p.ops.join('\n'));
      node.addContentStream(doc.context.register(stream));

      // Boites d'impression : TrimBox = format fini, BleedBox = fond perdu
      if (print.layout === 'single') {
        const g = singleGeometry(fmt, print);
        const toPt = (v) => v * PT_PER_MM;
        page.setTrimBox(toPt(g.x), toPt(g.y), toPt(fmt.w), toPt(fmt.h));
        page.setBleedBox(toPt(g.x - g.bleed), toPt(g.y - g.bleed), toPt(fmt.w + 2 * g.bleed), toPt(fmt.h + 2 * g.bleed));
      }
    });
    void PDFName;
    return { bytes: await doc.save(), pageCount: pages.length };
  }

  window.BadgeEngine = {
    PT_PER_MM, FORMATS, COLORS: C, IMAGE_BLEED, A4,
    color, colorFromCmyk, cmykToRgb, rgbCss,
    layoutText, roleLabel, personIssues, missingGlyphs,
    badgeSvg, pageSvg, svgArtLibrary, paginate, pageSize, sheetGeometry,
    buildPdf, FONT_BYTES,
  };
})();
