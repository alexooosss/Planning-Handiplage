/* Badges Handiplage · logique de l'interface */
(function () {
  'use strict';

  const E = window.BadgeEngine;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const STORE_KEY = 'badges-handiplage:v1';
  const ROSTER_KEY = 'handiplage:planning-roster'; // écrit par le site planning (même origine)

  /* ---------- Données de référence ---------- */
  const ROLE_IDS = ['handi', 'accueil', 'chef'];           // ordre de saisie (le plus fréquent d'abord)
  const PRINT_RANK = { chef: 0, accueil: 1, handi: 2 };   // ordre d'impression, comme vos planches 2026
  const ROLE_META = {
    handi: { name: 'Handiplagiste', short: 'Handiplagiste' },
    accueil: { name: 'Accueil · admin.', short: 'Accueil' },
    chef: { name: 'Chef·fe d’équipe', short: 'Chef·fe' },
  };
  const NAVY = E.COLORS.navy.cmyk, NAVY_LIGHT = E.COLORS.navyLight.cmyk;
  const THEMES = [
    { id: 'marine', name: 'Marine', base: NAVY, motif: NAVY_LIGHT },
    { id: 'outremer', name: 'Outremer', base: E.COLORS.blue.cmyk, motif: NAVY },
    { id: 'magenta', name: 'Magenta', base: E.COLORS.magenta.cmyk, motif: NAVY },
    { id: 'lagon', name: 'Lagon', base: [0.92, 0.12, 0.32, 0.02], motif: NAVY },
    { id: 'corail', name: 'Corail', base: [0, 0.74, 0.66, 0], motif: NAVY },
    { id: 'pin', name: 'Pin parasol', base: [0.82, 0.22, 0.85, 0.22], motif: NAVY },
  ];
  const defaultRole = (id) => ({
    handi: { labelM: 'Handiplagiste', labelF: 'Handiplagiste', roleWeight: 300, text: 'white', bg: { mode: 'pattern', theme: 'marine', base: NAVY, motif: NAVY_LIGHT, veil: 0.25, motifOnImage: false, image: null } },
    accueil: { labelM: 'Hôte d’accueil', labelF: 'Hôtesse d’accueil', roleWeight: 600, text: 'white', bg: { mode: 'pattern', theme: 'magenta', base: E.COLORS.magenta.cmyk, motif: NAVY, veil: 0.25, motifOnImage: false, image: null } },
    chef: { labelM: 'Chef d’équipe', labelF: 'Cheffe d’équipe', roleWeight: 300, text: 'white', bg: { mode: 'pattern', theme: 'outremer', base: E.COLORS.blue.cmyk, motif: NAVY, veil: 0.25, motifOnImage: false, image: null } },
  })[id];

  // Équipe des badges juillet 2026 (fichier Illustrator d'origine)
  const TEAM_2026 = [
    ['Alexis', 'Dalmasso', 'chef', 'm'], ['Marylou', 'Levet', 'chef', 'f'], ['Elise', 'Ruaut', 'accueil', 'f'],
    ['Timothy', 'Elsas Mallem', 'handi', 'm'], ['Raphaël', 'Gaillard', 'handi', 'm'], ['Jade', 'Rahmouni', 'handi', 'f'],
    ['Alicia', 'Bitton', 'handi', 'f'], ['Théo', 'Chambonnet', 'handi', 'm'], ['Elina', 'Bayle', 'handi', 'f'],
    ['Lalie', 'Sorrentino', 'handi', 'f'], ['Elise', 'Fraisse', 'handi', 'f'], ['Pauline', 'Rigaut', 'handi', 'f'],
    ['Louise', 'Navarre', 'handi', 'f'],
  ];

  /* ---------- État ---------- */
  const uid = () => Math.random().toString(36).slice(2, 10);
  const freshState = () => ({
    people: [],
    roles: { handi: defaultRole('handi'), accueil: defaultRole('accueil'), chef: defaultRole('chef') },
    print: { format: '85x53', layout: 'sheet', colorMode: 'cmyk', bleed: true, cropMarks: true, order: 'role' },
  });
  let state = loadState();
  const ui = { tab: 'team', view: 'badges', openId: null, selectedId: null, bgRole: 'handi', addRole: 'handi', addGender: 'm' };

  function loadState() {
    const s = freshState();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return s;
      return mergeState(s, JSON.parse(raw));
    } catch { return s; }
  }
  function mergeState(base, data) {
    if (Array.isArray(data.people)) {
      base.people = data.people.filter((p) => p && typeof p === 'object').map((p) => ({
        id: p.id || uid(), first: String(p.first || ''), last: String(p.last || ''),
        role: ROLE_IDS.includes(p.role) ? p.role : 'handi', gender: p.gender === 'f' ? 'f' : 'm',
        label: String(p.label || ''), copies: Math.max(1, Math.min(20, parseInt(p.copies, 10) || 1)),
      }));
    }
    if (data.roles) for (const id of ROLE_IDS) if (data.roles[id]) {
      const d = defaultRole(id), r = data.roles[id];
      base.roles[id] = { ...d, ...r, bg: { ...d.bg, ...(r.bg || {}) } };
    }
    if (data.print) base.print = { ...base.print, ...data.print };
    if (!E.FORMATS[base.print.format]) base.print.format = '85x53';
    return base;
  }
  let saveTimer = null, quotaWarned = false;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch {
        try {
          const lite = JSON.parse(JSON.stringify(state));
          for (const id of ROLE_IDS) lite.roles[id].bg.image = null;
          localStorage.setItem(STORE_KEY, JSON.stringify(lite));
          if (!quotaWarned) { quotaWarned = true; toast('Image trop lourde pour être mémorisée par le navigateur. Enregistrez le projet (.json) pour la garder.', { warn: true }); }
        } catch { /* stockage indisponible : l'application fonctionne quand même */ }
      }
    }, 250);
  }

  /* ---------- Rôles pour le moteur ---------- */
  function engineRole(id, override) {
    const r = override || state.roles[id];
    return {
      labelM: r.labelM, labelF: r.labelF, roleWeight: r.roleWeight, text: r.text,
      bg: { mode: r.bg.mode, base: E.colorFromCmyk(r.bg.base), motif: E.colorFromCmyk(r.bg.motif), veil: r.bg.veil, motifOnImage: r.bg.motifOnImage },
    };
  }
  const silentRole = (role) => ({ ...role, labelM: '', labelF: '' });
  const EMPTY = { first: '', last: '' };

  /* ---------- Images de fond ---------- */
  const prepared = {}; // roleId -> { key, preview, canvas, dpi, sig }
  const imgSig = (id) => { const im = state.roles[id].bg.image; return im ? im.id + '|' + state.print.format : null; };
  function imageFor(id) {
    const r = state.roles[id];
    if (r.bg.mode !== 'image' || !r.bg.image) return null;
    const p = prepared[id];
    return p && p.sig === imgSig(id) ? p : null;
  }
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function prepareImages() {
    let changed = false;
    for (const id of ROLE_IDS) {
      const sig = imgSig(id);
      if (!sig || (prepared[id] && prepared[id].sig === sig)) continue;
      const im = state.roles[id].bg.image;
      const img = await loadImg(im.dataUrl);
      const fmt = E.FORMATS[state.print.format];
      const bw = fmt.w + 2 * E.IMAGE_BLEED, bh = fmt.h + 2 * E.IMAGE_BLEED, ratio = bw / bh;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
      const W = Math.max(1, Math.min(Math.round((bw / 25.4) * 300), Math.round(sw)));
      const H = Math.max(1, Math.round(W / ratio));
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      const pw = Math.min(W, 720);
      const pv = document.createElement('canvas'); pv.width = pw; pv.height = Math.round(pw / ratio);
      const px = pv.getContext('2d'); px.imageSmoothingQuality = 'high'; px.drawImage(cv, 0, 0, pv.width, pv.height);
      prepared[id] = { key: id, preview: pv.toDataURL('image/jpeg', 0.85), canvas: cv, dpi: Math.round(sw / (bw / 25.4)), sig };
      changed = true;
    }
    if (changed) render();
  }
  async function importImage(file, roleId) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Format non pris en charge. Utilisez une image JPG ou PNG.', { warn: true }); return; }
    const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    let img;
    try { img = await loadImg(url); } catch { toast('Cette image n’a pas pu être lue.', { warn: true }); return; }
    // Réduction pour la mémoire du navigateur : 2400 px suffisent largement (≈ 680 dpi sur 89 mm).
    const max = 2400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const bg = state.roles[roleId].bg;
    bg.image = { id: uid(), name: file.name, dataUrl: cv.toDataURL('image/jpeg', 0.9), w: img.naturalWidth, h: img.naturalHeight };
    bg.mode = 'image';
    save(); render(); prepareImages();
  }

  /* ---------- Utilitaires ---------- */
  function niceCase(s) {
    const t = s.trim().replace(/\s+/g, ' ');
    if (!t || (t !== t.toLowerCase() && t !== t.toUpperCase())) return t;
    return t.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('fr-FR'));
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const roleRgb = (id) => E.rgbCss(E.colorFromCmyk(state.roles[id].bg.base));
  const fullName = (p) => [p.first.trim(), p.last.trim().toLocaleUpperCase('fr-FR')].filter(Boolean).join(' ') || 'Sans nom';
  function download(bytes, name, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- Toasts ---------- */
  function toast(msg, { warn = false, action = null, timeout = 5000 } = {}) {
    const t = document.createElement('div');
    t.className = 'toast' + (warn ? ' warn' : '');
    t.innerHTML = `<svg class="i" aria-hidden="true"><use href="#${warn ? 'i-alert' : 'i-check'}"/></svg><span></span>`;
    t.querySelector('span').textContent = msg;
    const close = () => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 170); };
    if (action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => { action.run(); close(); });
      t.appendChild(b);
    }
    $('#toasts').appendChild(t);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(close, timeout);
  }

  /* ---------- Liste d'impression ---------- */
  function orderedPeople() {
    const list = state.people.slice();
    if (state.print.order === 'role') {
      list.sort((a, b) => PRINT_RANK[a.role] - PRINT_RANK[b.role]
        || a.last.localeCompare(b.last, 'fr', { sensitivity: 'base' })
        || a.first.localeCompare(b.first, 'fr', { sensitivity: 'base' }));
    }
    return list;
  }
  function printItems() {
    const roles = {}; for (const id of ROLE_IDS) roles[id] = engineRole(id);
    const out = [];
    for (const p of orderedPeople()) {
      if (!p.first.trim() && !p.last.trim()) continue;
      for (let i = 0; i < p.copies; i++) out.push({ person: p, role: roles[p.role], imageKey: imageFor(p.role) ? p.role : null });
    }
    return out;
  }

  /* ---------- Rendu ---------- */
  let raf = 0;
  function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderNow); }
  function renderNow() {
    renderSync();
    renderSummary();
    renderTeam();
    renderAddForm();
    renderBg();
    renderPrint();
    renderStage();
  }

  function renderSummary() {
    const items = printItems();
    const pages = E.paginate(items, state.print).length;
    const unit = state.print.layout === 'sheet' ? ['planche A4', 'planches A4'] : ['page', 'pages'];
    $('#summary').innerHTML = items.length
      ? `<strong>${items.length}</strong> badge${items.length > 1 ? 's' : ''} · <strong>${pages}</strong> ${pages > 1 ? unit[1] : unit[0]}`
      : 'Aucun badge';
    $('#teamCount').textContent = state.people.length || '';
    $('#listCount').textContent = state.people.length ? `· ${state.people.length}` : '';
    for (const b of [$('#exportBtn'), $('#exportBtn2')]) b.disabled = !items.length;
    $('#sheetsLabel').textContent = state.print.layout === 'sheet' ? 'Planches A4' : 'Pages';
  }

  /* Équipe */
  function thumbSvg(roleId) {
    return E.badgeSvg(EMPTY, silentRole(engineRole(roleId)), imageFor(roleId), '85x53', 'aria-hidden="true" focusable="false"').svg;
  }
  function personFlags(p) {
    const issues = E.personIssues(p, engineRole(p.role));
    let h = '';
    if (p.copies > 1) h += `<span class="chip neutral">×${p.copies}</span>`;
    for (const it of issues) h += `<span class="chip${it.kind === 'empty' ? ' danger' : ''}" title="${esc(it.text)}"><svg class="i" aria-hidden="true"><use href="#i-alert"/></svg>${esc(it.kind === 'shrink' ? 'réduit' : it.kind === 'glyph' ? 'caractère' : 'vide')}</span>`;
    return h;
  }
  function rowDisplay(p) {
    const role = engineRole(p.role);
    return `
      <div class="person-thumb">${thumbSvg(p.role)}</div>
      <button class="person-main" type="button" data-act="toggle" aria-expanded="${ui.openId === p.id}" aria-controls="edit-${p.id}">
        <span class="person-name">${esc(p.first.trim())} <span class="ln">${esc(p.last.trim().toLocaleUpperCase('fr-FR'))}</span>${!p.first.trim() && !p.last.trim() ? '<span class="muted">Sans nom</span>' : ''}</span>
        <span class="person-role">${esc(E.roleLabel(p, role))}<span class="person-flags">${personFlags(p)}</span></span>
      </button>
      <div class="person-actions">
        <button class="icon-btn" type="button" data-act="toggle" aria-label="Modifier ${esc(fullName(p))}"><svg class="i" aria-hidden="true"><use href="#i-pen"/></svg></button>
        <button class="icon-btn danger" type="button" data-act="delete" aria-label="Supprimer ${esc(fullName(p))}"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg></button>
      </div>`;
  }
  function rowEditor(p) {
    const r = state.roles[p.role];
    return `
      <div class="field-row">
        <div class="field"><label for="e-first-${p.id}">Prénom</label><input id="e-first-${p.id}" data-f="first" type="text" spellcheck="false" value="${esc(p.first)}"></div>
        <div class="field"><label for="e-last-${p.id}">Nom</label><input id="e-last-${p.id}" data-f="last" type="text" spellcheck="false" value="${esc(p.last)}"></div>
      </div>
      <fieldset class="field"><legend>Fonction</legend>
        <div class="seg seg-sm">${ROLE_IDS.map((id) => `<label><input type="radio" name="e-role-${p.id}" data-f="role" value="${id}" ${p.role === id ? 'checked' : ''}><span><i class="dot" style="background:${roleRgb(id)}"></i>${esc(ROLE_META[id].short)}</span></label>`).join('')}</div>
      </fieldset>
      ${r.labelM !== r.labelF ? `<fieldset class="field"><legend>Accord</legend>
        <div class="seg seg-sm"><label><input type="radio" name="e-g-${p.id}" data-f="gender" value="m" ${p.gender !== 'f' ? 'checked' : ''}><span>${esc(r.labelM)}</span></label><label><input type="radio" name="e-g-${p.id}" data-f="gender" value="f" ${p.gender === 'f' ? 'checked' : ''}><span>${esc(r.labelF)}</span></label></div>
      </fieldset>` : ''}
      <div class="field"><label for="e-label-${p.id}">Libellé personnalisé <span class="muted">(facultatif)</span></label><input id="e-label-${p.id}" data-f="label" type="text" placeholder="${esc(E.roleLabel({ ...p, label: '' }, engineRole(p.role)))}" value="${esc(p.label)}"></div>
      <div class="edit-foot">
        <div class="field copies"><label for="e-copies-${p.id}">Exemplaires</label><input id="e-copies-${p.id}" data-f="copies" type="number" min="1" max="20" inputmode="numeric" value="${p.copies}"></div>
        <button class="btn btn-ink btn-sm" type="button" data-act="close">Terminé</button>
      </div>`;
  }
  function renderTeam(force) {
    const list = $('#people');
    // Ne pas reconstruire la liste pendant la saisie dans un éditeur (garde le focus)
    if (!force && list.contains(document.activeElement) && document.activeElement.matches('input')) {
      refreshRows();
      return;
    }
    $('#teamEmpty').hidden = state.people.length > 0;
    list.innerHTML = state.people.map((p) => `
      <li class="person${ui.openId === p.id ? ' is-open' : ''}" data-id="${p.id}">
        <div class="person-row">${rowDisplay(p)}</div>
        <div class="person-edit" id="edit-${p.id}" ${ui.openId === p.id ? '' : 'hidden'}>${ui.openId === p.id ? rowEditor(p) : ''}</div>
      </li>`).join('');
  }
  function refreshRows() {
    for (const li of $$('#people .person')) {
      const p = state.people.find((x) => x.id === li.dataset.id);
      if (p) li.querySelector('.person-row').innerHTML = rowDisplay(p);
    }
  }

  function renderAddForm() {
    const box = $('#addRole');
    if (!box.dataset.built || box.dataset.sig !== rolesSig()) {
      box.innerHTML = ROLE_IDS.map((id) => `<label class="role-opt"><input type="radio" name="addRole" value="${id}" ${ui.addRole === id ? 'checked' : ''}><span>${thumbSvg(id)}${esc(ROLE_META[id].name)}</span></label>`).join('');
      box.dataset.built = '1'; box.dataset.sig = rolesSig();
    }
    const r = state.roles[ui.addRole];
    const showAccord = r.labelM !== r.labelF;
    $('#addAccordWrap').hidden = !showAccord;
    if (showAccord) {
      const [m, f] = $$('#addAccord span');
      m.textContent = r.labelM; f.textContent = r.labelF;
    }
    $('#addAccordPreview').innerHTML = '';
  }
  const rolesSig = () => JSON.stringify(ROLE_IDS.map((id) => { const b = state.roles[id].bg; return [b.mode, b.base, b.motif, b.motifOnImage, b.veil, imageFor(id) ? 1 : 0]; }));

  /* Fonds */
  function renderBg() {
    if (ui.tab !== 'bg') return;
    const id = ui.bgRole, r = state.roles[id], bg = r.bg;
    $('#bgRoleSwitch').innerHTML = ROLE_IDS.map((rid) => `<label><input type="radio" name="bgRole" value="${rid}" ${rid === id ? 'checked' : ''}><span><i class="dot" style="background:${roleRgb(rid)}"></i>${esc(ROLE_META[rid].short)}</span></label>`).join('');
    const sample = state.people.find((p) => p.role === id) || { first: 'Prénom', last: 'Nom', gender: 'f' };
    $('#bgPreview').innerHTML = E.badgeSvg(sample, engineRole(id), imageFor(id), state.print.format, `role="img" aria-label="Aperçu du badge ${esc(ROLE_META[id].name)}"`).svg;
    $$('input[name="bgMode"]').forEach((i) => { i.checked = i.value === bg.mode; });
    $('#bgColors').hidden = bg.mode === 'image';
    $('#bgImage').hidden = bg.mode !== 'image';

    if (bg.mode !== 'image') {
      $('#themes').innerHTML = THEMES.map((t) => {
        const tr = engineRole(id, { ...r, bg: { ...bg, base: t.base, motif: t.motif } });
        const checked = bg.theme === t.id;
        return `<label class="theme"><input type="radio" name="theme" value="${t.id}" ${checked ? 'checked' : ''}><span>${E.badgeSvg(EMPTY, silentRole(tr), null, '85x53', 'aria-hidden="true"').svg}${esc(t.name)}</span></label>`;
      }).join('');
      if (!$('#customColors').contains(document.activeElement)) {
        $('#cmykBase').innerHTML = cmykInputs('base', 'Fond', bg.base);
        $('#cmykMotif').innerHTML = bg.mode === 'pattern' ? cmykInputs('motif', 'Motif vagues', bg.motif) : '';
      } else {
        for (const k of ['base', 'motif']) { const s = $(`#sw-${k}`); if (s) s.style.background = E.rgbCss(E.colorFromCmyk(bg[k])); }
      }
    } else {
      const info = $('#imgInfo');
      const im = bg.image, pr = prepared[id];
      info.hidden = !im;
      $('#drop').hidden = !!im;
      if (im) {
        const q = pr ? (pr.dpi >= 250 ? `<span class="q-ok">Qualité impression : ${pr.dpi} dpi</span>` : `<span class="q-low">Résolution faible : ${pr.dpi} dpi (300 conseillés)</span>`) : 'Préparation…';
        info.innerHTML = `<img src="${pr ? pr.preview : im.dataUrl}" alt=""><div class="meta"><strong>${esc(im.name)}</strong><span>${im.w} × ${im.h} px · ${q}</span></div>
          <button class="btn btn-ghost btn-sm" type="button" data-act="replace-img">Remplacer</button>`;
      }
      $('#veil').value = Math.round(bg.veil * 100);
      $('#veilOut').textContent = `${Math.round(bg.veil * 100)} %`;
      $('#motifOnImage').checked = !!bg.motifOnImage;
    }
    $$('input[name="textColor"]').forEach((i) => { i.checked = i.value === r.text; });
    if (document.activeElement !== $('#labelM')) $('#labelM').value = r.labelM;
    if (document.activeElement !== $('#labelF')) $('#labelF').value = r.labelF;
    $('#roleBold').checked = r.roleWeight === 600;
  }
  function cmykInputs(key, title, vals) {
    const names = ['C', 'M', 'J', 'N'];
    return `<span class="cap">${title}</span><span class="swatch" id="sw-${key}" style="background:${E.rgbCss(E.colorFromCmyk(vals))}"></span>` +
      names.map((n, i) => `<label>${n}<input type="number" min="0" max="100" step="1" inputmode="numeric" data-cmyk="${key}" data-ch="${i}" value="${Math.round(vals[i] * 1000) / 10}" aria-label="${title} ${['cyan', 'magenta', 'jaune', 'noir'][i]} en %"></label>`).join('');
  }

  /* Impression */
  function renderPrint() {
    if (ui.tab !== 'print') return;
    const pr = state.print;
    $('#formatChoices').innerHTML = Object.entries(E.FORMATS).map(([k, f]) => `<label class="choice"><input type="radio" name="format" value="${k}" ${pr.format === k ? 'checked' : ''}><span class="choice-body"><strong>${f.label}</strong><span>${f.hint}</span></span></label>`).join('');
    for (const name of ['layout', 'colorMode', 'order']) $$(`input[name="${name}"]`).forEach((i) => { i.checked = i.value === pr[name]; });
    $('#bleed').checked = pr.bleed;
    $('#cropMarks').checked = pr.cropMarks;
  }

  /* Aperçu */
  function renderStage() {
    const body = $('#stageBody');
    const items = printItems();
    const counts = { chef: 0, accueil: 0, handi: 0 };
    for (const it of items) counts[it.person.role]++;
    $('#legend').innerHTML = ['chef', 'accueil', 'handi'].map((id) => `<li><i class="dot" style="background:${roleRgb(id)}"></i>${esc(ROLE_META[id].name)} <strong>${counts[id]}</strong></li>`).join('');
    $$('input[name="view"]').forEach((i) => { i.checked = i.value === ui.view; });

    if (!items.length) {
      const sample = { first: 'Prénom', last: 'Nom', gender: 'f' };
      body.innerHTML = `<div class="stage-empty">
        <div class="ghost">${E.badgeSvg(sample, engineRole(ui.addRole), imageFor(ui.addRole), state.print.format, 'role="img" aria-label="Exemple de badge"').svg}</div>
        <h2>Vos badges apparaîtront ici</h2>
        <p>Ajoutez une première personne à gauche, ou repartez de l’équipe de juillet 2026 pour modifier les noms.</p>
        <button class="btn btn-ink" type="button" data-act="load-2026"><svg class="i" aria-hidden="true"><use href="#i-users"/></svg>Reprendre l’équipe juillet 2026</button>
      </div>`;
      return;
    }

    if (ui.view === 'badges') {
      body.innerHTML = `<div class="badge-grid">${items.map((it, i) => {
        const { svg } = E.badgeSvg(it.person, it.role, it.imageKey ? prepared[it.imageKey] : null, state.print.format, `role="img" aria-label="Badge de ${esc(fullName(it.person))}"`);
        const issues = E.personIssues(it.person, it.role);
        return `<figure class="badge-card">
          <button class="badge-btn${ui.selectedId === it.person.id ? ' is-selected' : ''}" type="button" data-pick="${it.person.id}" aria-label="Modifier le badge de ${esc(fullName(it.person))}">${svg}</button>
          <figcaption class="badge-meta"><span class="num">${String(i + 1).padStart(2, '0')}</span>${issues.map((x) => `<span class="chip${x.kind === 'empty' ? ' danger' : ''}"><svg class="i" aria-hidden="true"><use href="#i-alert"/></svg>${esc(x.text)}</span>`).join('')}</figcaption>
        </figure>`;
      }).join('')}</div>`;
    } else {
      const pages = E.paginate(items, state.print);
      const ctx = { imageFor: (it) => (it.imageKey ? prepared[it.imageKey] : null), slug: null };
      const single = state.print.layout === 'single';
      body.innerHTML = `<div class="sheets${single ? ' single' : ''}">${pages.map((pg, i) => `
        <figure class="sheet">
          <figcaption>${single ? 'Page' : 'Planche'} ${i + 1} / ${pages.length}<span>${pg.length} badge${pg.length > 1 ? 's' : ''}</span></figcaption>
          <div class="sheet-page">${E.pageSvg(pg, state.print, ctx, `role="img" aria-label="${single ? 'Page' : 'Planche'} ${i + 1}"`)}</div>
        </figure>`).join('')}</div>`;
    }
  }

  /* ---------- Actions ---------- */
  function addPerson(p, { flash = true } = {}) {
    const person = { id: uid(), first: niceCase(p.first || ''), last: (p.last || '').trim().replace(/\s+/g, ' '), role: p.role || 'handi', gender: p.gender === 'f' ? 'f' : 'm', label: p.label || '', copies: p.copies || 1 };
    state.people.push(person);
    if (flash) ui.flashId = person.id;
    return person;
  }
  function removePerson(id) {
    const idx = state.people.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const [p] = state.people.splice(idx, 1);
    if (ui.openId === id) ui.openId = null;
    save(); render();
    toast(`Badge de ${fullName(p)} supprimé.`, { action: { label: 'Annuler', run: () => { state.people.splice(idx, 0, p); save(); render(); } } });
  }
  function loadTeam2026() {
    const existing = new Set(state.people.map((p) => (p.first + '|' + p.last).toLowerCase()));
    let n = 0;
    for (const [first, last, role, gender] of TEAM_2026) {
      if (existing.has((first + '|' + last).toLowerCase())) continue;
      addPerson({ first, last, role, gender }, { flash: false }); n++;
    }
    save(); render();
    toast(n ? `${n} badges de l’équipe juillet 2026 ajoutés. Modifiez les noms au besoin.` : 'L’équipe juillet 2026 est déjà dans la liste.');
  }
  function clearAll() {
    if (!state.people.length) return;
    const backup = state.people.slice();
    state.people = []; ui.openId = null;
    save(); render();
    toast(`${plural(backup.length, 'badge supprimé', 'badges supprimés')}.`, { action: { label: 'Annuler', run: () => { state.people = backup; save(); render(); } }, timeout: 8000 });
  }

  function openEditor(id, { focus = false } = {}) {
    ui.openId = id; ui.selectedId = id;
    setTab('team');
    renderTeam(true); renderStage();
    const li = $(`#people .person[data-id="${id}"]`);
    if (li) {
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (focus) li.querySelector('[data-f="first"]')?.focus({ preventScroll: true });
    }
  }

  /* Import texte */
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ROLE_RE = /chef|accueil|h[oô]te|admin|r[ée]serv|agent|handi|plagist|responsable/i;
  function detectRole(s) {
    const t = strip(s || '');
    if (/chef|responsable/.test(t)) return { role: 'chef', gender: /cheffe/.test(t) ? 'f' : 'm' };
    if (/accueil|hote|admin|reserv|agent/.test(t)) return { role: 'accueil', gender: /hotesse/.test(t) ? 'f' : 'm' };
    return { role: 'handi', gender: 'm' };
  }
  function splitName(s) {
    const words = s.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return { first: words[0] || '', last: '' };
    const upper = words.filter((w) => w.length > 1 && w === w.toLocaleUpperCase('fr-FR') && /\p{L}/u.test(w));
    if (upper.length && upper.length < words.length) {
      return { first: words.filter((w) => !upper.includes(w)).join(' '), last: upper.join(' ') };
    }
    return { first: words[0], last: words.slice(1).join(' ') };
  }
  function parseList(text) {
    const rows = [];
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line) continue;
      let cols = (line.includes('\t') ? line.split('\t') : line.split(/\s*[;,]\s*/)).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (/^pr[ée]nom\b|^nom\b/i.test(cols[0])) continue;
      let roleText = '';
      const ri = cols.findIndex((c, i) => i > 0 && ROLE_RE.test(c));
      if (ri >= 0) { roleText = cols[ri]; cols.splice(ri, 1); }
      cols = cols.filter(Boolean);
      let first = '', last = '';
      if (cols.length === 1) {
        let s = cols[0];
        const m = s.match(/^(.*?)\s+[-–:]\s+(.*)$/);
        if (m && ROLE_RE.test(m[2])) { s = m[1]; roleText = m[2]; }
        ({ first, last } = splitName(s));
      } else if (cols.length >= 2) {
        first = cols[0]; last = cols.slice(1).join(' ');
      }
      if (!first && !last) continue;
      rows.push({ first, last, ...detectRole(roleText) });
    }
    return rows;
  }
  function describeRows(rows) {
    const c = { chef: 0, accueil: 0, handi: 0 };
    rows.forEach((r) => c[r.role]++);
    const parts = [];
    if (c.chef) parts.push(plural(c.chef, 'chef·fe', 'chef·fes'));
    if (c.accueil) parts.push(`${c.accueil} accueil`);
    if (c.handi) parts.push(plural(c.handi, 'handiplagiste', 'handiplagistes'));
    return parts.join(', ');
  }

  /* ---------- Équipe du planning ---------- */
  const PLANNING_ROLE = { chef: 'chef', adm: 'accueil', agent: 'handi' };
  const KNOWN_GENDER = Object.fromEntries(TEAM_2026.map(([f, , , g]) => [strip(f), g]));
  const personKey = (first, last) => strip(first.trim()) + '|' + strip(last.trim());
  function readRoster() {
    try {
      const data = JSON.parse(localStorage.getItem(ROSTER_KEY) || 'null');
      if (!data || !Array.isArray(data.people)) return null;
      const seen = new Set(), out = [];
      for (const a of data.people) {
        const name = String((a && a.name) || '').trim();
        if (!name || /^nouvel agent$/i.test(name)) continue;
        const { first, last } = splitName(name);
        const key = personKey(first, last);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ first: niceCase(first), last, role: PLANNING_ROLE[a.role] || 'handi', gender: a.gender === 'f' || a.gender === 'm' ? a.gender : (KNOWN_GENDER[strip(first)] || 'm') });
      }
      return out;
    } catch { return null; }
  }
  let roster = readRoster();
  const hasBadge = (r) => state.people.some((p) => personKey(p.first, p.last) === personKey(r.first, r.last));
  const missingFromPlanning = () => (roster || []).filter((r) => !hasBadge(r));

  function renderSync() {
    $$('[data-planning-only]').forEach((b) => { b.hidden = !roster; });
    const missing = missingFromPlanning();
    $('#sync').hidden = !missing.length;
    if (missing.length) {
      $('#syncText').innerHTML = `<strong>${plural(missing.length, 'personne', 'personnes')}</strong> du planning ${missing.length > 1 ? 'n’ont' : 'n’a'} pas encore de badge.`;
      $('#syncBtn').textContent = missing.length > 1 ? `Ajouter les ${missing.length}` : 'Ajouter';
    }
  }
  function loadPlanningTeam() {
    const missing = missingFromPlanning();
    if (!missing.length) { toast(roster ? 'Toute l’équipe du planning a déjà son badge.' : 'Aucune équipe trouvée : ouvrez cet outil depuis le site planning.'); return; }
    const before = state.people.length;
    missing.forEach((r) => addPerson(r, { flash: false }));
    save(); render();
    const accord = missing.some((r) => r.role !== 'handi');
    toast(`${plural(missing.length, 'badge ajouté', 'badges ajoutés')} depuis le planning.${accord ? ' Vérifiez l’accord (Chef/Cheffe, Hôte/Hôtesse).' : ''}`, { timeout: 7000, action: { label: 'Annuler', run: () => { state.people.splice(before); save(); render(); } } });
  }

  /* Suggestions de saisie (prénom / nom) */
  const sugg = { items: [], active: -1 };
  const hl = (text, q) => {
    if (!q) return esc(text);
    const i = strip(text).indexOf(q);
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };
  function updateSuggest() {
    const qf = strip($('#addFirst').value.trim()), ql = strip($('#addLast').value.trim());
    if (!roster || !roster.length) { closeSuggest(); return; }
    const match = (r) => (!qf || strip(r.first).includes(qf) || strip(r.last).includes(qf)) && (!ql || strip(r.last).includes(ql));
    const rank = (r) => (hasBadge(r) ? 2 : 0) + (qf && !strip(r.first).startsWith(qf) && !strip(r.last).startsWith(qf) ? 1 : 0);
    sugg.items = roster.filter(match).sort((a, b) => rank(a) - rank(b) || a.last.localeCompare(b.last, 'fr', { sensitivity: 'base' })).slice(0, 8);
    if (!sugg.items.length) { closeSuggest(); return; }
    if (sugg.active >= sugg.items.length) sugg.active = -1;
    const list = $('#suggest');
    list.innerHTML = `<li class="suggest-head" role="presentation">Équipe du planning</li>` + sugg.items.map((r, i) => {
      const done = hasBadge(r);
      return `<li role="option" id="sg-${i}" data-i="${i}" aria-selected="${i === sugg.active}"${done ? ' class="is-done"' : ''}>
        <i class="dot" style="background:${roleRgb(r.role)}"></i>
        <span>${hl(r.first, qf)} <span class="ln">${hl(r.last.toLocaleUpperCase('fr-FR'), ql || qf)}</span></span>
        <span class="role">${done ? 'badge déjà créé' : esc(ROLE_META[r.role].short)}</span></li>`;
    }).join('');
    list.hidden = false;
    for (const id of ['#addFirst', '#addLast']) $(id).setAttribute('aria-expanded', 'true');
    const cur = document.activeElement;
    if (cur && cur.matches('#addFirst, #addLast')) {
      if (sugg.active >= 0) { cur.setAttribute('aria-activedescendant', `sg-${sugg.active}`); $(`#sg-${sugg.active}`).scrollIntoView({ block: 'nearest' }); }
      else cur.removeAttribute('aria-activedescendant');
    }
  }
  function closeSuggest() {
    $('#suggest').hidden = true; sugg.active = -1;
    for (const id of ['#addFirst', '#addLast']) { $(id).setAttribute('aria-expanded', 'false'); $(id).removeAttribute('aria-activedescendant'); }
  }
  function pickSuggest(i) {
    const r = sugg.items[i]; if (!r) return;
    $('#addFirst').value = r.first; $('#addLast').value = r.last;
    ui.addRole = r.role; ui.addGender = r.gender;
    renderAddForm();
    $$('input[name="addRole"]').forEach((x) => { x.checked = x.value === r.role; });
    $$('input[name="addGender"]').forEach((x) => { x.checked = x.value === r.gender; });
    closeSuggest();
    $('#addError').textContent = ''; $('#addFirst').removeAttribute('aria-invalid');
    $('#addLast').focus();
  }

  /* Export PDF */
  async function exportPdf() {
    const items = printItems();
    if (!items.length) { toast('Ajoutez au moins un badge avant d’exporter.', { warn: true }); return; }
    const btns = [$('#exportBtn'), $('#exportBtn2')];
    btns.forEach((b) => { b.setAttribute('aria-busy', 'true'); b.disabled = true; });
    const label = $('#exportBtn .btn-label'); const prev = label.textContent; label.textContent = 'Génération…';
    try {
      await prepareImages();
      const fresh = printItems();
      const images = {}; for (const id of ROLE_IDS) if (imageFor(id)) images[id] = prepared[id];
      const year = new Date().getFullYear();
      const { bytes, pageCount } = await E.buildPdf(fresh, state.print, images, { title: `Badges Handiplage ${year}`, author: 'CCAS · Handiplage' });
      const fmt = E.FORMATS[state.print.format];
      download(bytes, `Badges-Handiplage_${fmt.label.replace(/[^\d,x×]/g, '').replace('×', 'x')}mm_${state.print.colorMode.toUpperCase()}_${today()}.pdf`, 'application/pdf');
      const unit = state.print.layout === 'sheet' ? (pageCount > 1 ? 'planches A4' : 'planche A4') : (pageCount > 1 ? 'pages' : 'page');
      toast(`PDF prêt : ${plural(fresh.length, 'badge', 'badges')} sur ${pageCount} ${unit}. Imprimez en taille réelle (100 %).`, { timeout: 7000 });
    } catch (err) {
      console.error(err);
      toast('La génération du PDF a échoué. Réessayez ; si le problème persiste, retirez l’image de fond.', { warn: true, timeout: 8000 });
    } finally {
      btns.forEach((b) => b.removeAttribute('aria-busy'));
      label.textContent = prev;
      renderSummary();
    }
  }

  /* ---------- Onglets ---------- */
  function setTab(tab) {
    ui.tab = tab;
    for (const t of ['team', 'bg', 'print']) {
      const btn = $(`#tab-${t}`), panel = $(`#panel-${t}`);
      const on = t === tab;
      btn.setAttribute('aria-selected', on); btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    }
    renderBg(); renderPrint();
  }

  /* ---------- Événements ---------- */
  function bind() {
    // Onglets (souris + flèches)
    const tabs = ['team', 'bg', 'print'];
    for (const t of tabs) $(`#tab-${t}`).addEventListener('click', () => setTab(t));
    $('.tabs').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      let i = tabs.indexOf(ui.tab);
      i = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
      setTab(tabs[i]); $(`#tab-${tabs[i]}`).focus(); e.preventDefault();
    });

    // Formulaire d'ajout
    $('#addRole').addEventListener('change', (e) => { ui.addRole = e.target.value; renderAddForm(); if (!state.people.length) renderStage(); });
    $('#addAccord').addEventListener('change', (e) => { ui.addGender = e.target.value; });
    $('#addFirst').addEventListener('blur', (e) => { e.target.value = niceCase(e.target.value); });
    $('#addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const first = $('#addFirst').value, last = $('#addLast').value;
      if (!first.trim() && !last.trim()) {
        $('#addError').textContent = 'Indiquez au moins un prénom ou un nom.';
        $('#addFirst').setAttribute('aria-invalid', 'true'); $('#addFirst').focus();
        return;
      }
      $('#addError').textContent = ''; $('#addFirst').removeAttribute('aria-invalid');
      const dup = state.people.some((p) => strip(p.first) === strip(first.trim()) && strip(p.last) === strip(last.trim()));
      const person = addPerson({ first, last, role: ui.addRole, gender: ui.addGender });
      save(); renderNow();
      const li = $(`#people .person[data-id="${person.id}"]`);
      if (li) { li.classList.add('is-flash'); li.scrollIntoView({ block: 'nearest' }); }
      if (dup) toast(`${fullName(person)} figure déjà dans la liste.`, { warn: true, action: { label: 'Retirer le doublon', run: () => removePerson(person.id) } });
      $('#addFirst').value = ''; $('#addLast').value = '';
      $('#addFirst').focus(); closeSuggest();
    });
    $('#addFirst').addEventListener('input', () => { $('#addError').textContent = ''; $('#addFirst').removeAttribute('aria-invalid'); });

    // Suggestions issues du planning
    for (const id of ['#addFirst', '#addLast']) {
      const inp = $(id);
      inp.addEventListener('input', () => { sugg.active = -1; updateSuggest(); });
      inp.addEventListener('focus', () => { if (inp.value.trim() || id === '#addFirst') updateSuggest(); });
      inp.addEventListener('blur', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('#addFirst, #addLast')) closeSuggest(); }, 120));
      inp.addEventListener('keydown', (e) => {
        if ($('#suggest').hidden) { if (e.key === 'ArrowDown') { updateSuggest(); e.preventDefault(); } return; }
        const n = sugg.items.length;
        if (e.key === 'ArrowDown') { sugg.active = (sugg.active + 1) % n; updateSuggest(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sugg.active = (sugg.active - 1 + n) % n; updateSuggest(); e.preventDefault(); }
        else if (e.key === 'Enter' && sugg.active >= 0) { e.preventDefault(); pickSuggest(sugg.active); }
        else if (e.key === 'Escape') { closeSuggest(); e.preventDefault(); }
        else if (e.key === 'Tab') closeSuggest();
      });
    }
    $('#suggest').addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-i]'); if (!li) return;
      e.preventDefault(); pickSuggest(+li.dataset.i);
    });

    // L'équipe du planning a changé (page parente ou autre onglet)
    const refreshRoster = () => { roster = readRoster(); render(); };
    window.addEventListener('storage', (e) => { if (e.key === ROSTER_KEY) refreshRoster(); });
    window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'handiplage:roster') refreshRoster(); });

    // Liste : délégation
    $('#people').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const id = btn.closest('.person').dataset.id;
      const act = btn.dataset.act;
      if (act === 'toggle') { if (ui.openId === id) { ui.openId = null; renderTeam(true); } else openEditor(id, { focus: true }); }
      else if (act === 'close') { ui.openId = null; renderTeam(true); $(`#people .person[data-id="${id}"] .person-main`)?.focus(); }
      else if (act === 'delete') removePerson(id);
    });
    $('#people').addEventListener('input', (e) => {
      const f = e.target.dataset.f; if (!f) return;
      const p = state.people.find((x) => x.id === e.target.closest('.person').dataset.id); if (!p) return;
      if (f === 'copies') p.copies = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
      else if (f !== 'role' && f !== 'gender') p[f] = e.target.value;
      save(); render();
    });
    $('#people').addEventListener('change', (e) => {
      const f = e.target.dataset.f; if (!f) return;
      const p = state.people.find((x) => x.id === e.target.closest('.person').dataset.id); if (!p) return;
      if (f === 'role' || f === 'gender') { p[f] = e.target.value; save(); renderTeam(true); renderSummary(); renderStage(); $(`#people [name="${e.target.name}"][value="${e.target.value}"]`)?.focus(); }
      if (f === 'first' && e.target.value !== niceCase(e.target.value)) { p.first = e.target.value = niceCase(e.target.value); save(); render(); }
      if (f === 'copies') e.target.value = p.copies;
    });
    $('#people').addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ui.openId) { const id = ui.openId; ui.openId = null; renderTeam(true); $(`#people .person[data-id="${id}"] .person-main`)?.focus(); }
      if (e.key === 'Enter' && e.target.matches('.person-edit input[type="text"], .person-edit input[type="number"]')) { e.preventDefault(); const id = ui.openId; ui.openId = null; renderTeam(true); $(`#people .person[data-id="${id}"] .person-main`)?.focus(); }
    });

    // Import par copier-coller
    $('#importToggle').addEventListener('click', () => {
      const box = $('#importBox'); box.hidden = !box.hidden;
      $('#importToggle').setAttribute('aria-expanded', !box.hidden);
      if (!box.hidden) $('#importText').focus();
    });
    $('#importText').addEventListener('input', () => {
      const rows = parseList($('#importText').value);
      $('#importBtn').disabled = !rows.length;
      $('#importBtn').textContent = rows.length ? `Ajouter ${rows.length}` : 'Ajouter';
      $('#importInfo').textContent = rows.length ? `${plural(rows.length, 'personne détectée', 'personnes détectées')} : ${describeRows(rows)}.` : 'La fonction est reconnue par mot-clé : chef, cheffe, accueil, hôte, handiplagiste. Sans précision : handiplagiste.';
    });
    $('#importBtn').addEventListener('click', () => {
      const rows = parseList($('#importText').value);
      if (!rows.length) return;
      const before = state.people.length;
      rows.forEach((r) => addPerson(r, { flash: false }));
      save(); render();
      $('#importText').value = ''; $('#importText').dispatchEvent(new Event('input'));
      $('#importBox').hidden = true; $('#importToggle').setAttribute('aria-expanded', 'false');
      toast(`${plural(rows.length, 'badge ajouté', 'badges ajoutés')}.`, { action: { label: 'Annuler', run: () => { state.people.splice(before); save(); render(); } } });
    });

    // Menu "plus"
    const menu = $('#moreMenu'), moreBtn = $('#moreBtn');
    const closeMenu = () => { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); };
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden; moreBtn.setAttribute('aria-expanded', !menu.hidden);
      if (!menu.hidden) menu.querySelector('button').focus();
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    menu.addEventListener('keydown', (e) => {
      const items = $$('button', menu); const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { closeMenu(); moreBtn.focus(); }
      if (e.key === 'ArrowDown') { items[(i + 1) % items.length].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { items[(i - 1 + items.length) % items.length].focus(); e.preventDefault(); }
    });

    // Actions globales (menu, état vide, etc.)
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.closest('#people')) return;
      const act = b.dataset.act;
      if (b.closest('#moreMenu')) closeMenu();
      if (act === 'load-2026') loadTeam2026();
      else if (act === 'load-planning') loadPlanningTeam();
      else if (act === 'clear') clearAll();
      else if (act === 'save-project') {
        download(new Blob([JSON.stringify({ app: 'badges-handiplage', version: 1, savedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' }), `Projet-badges-handiplage_${today()}.json`);
        toast('Projet enregistré. Rouvrez-le plus tard avec « Ouvrir un projet ».');
      }
      else if (act === 'open-project') $('#fileProject').click();
      else if (act === 'import-file') $('#fileList').click();
      else if (act === 'export-csv') {
        const rows = [['Prénom', 'Nom', 'Fonction', 'Libellé', 'Exemplaires']].concat(state.people.map((p) => [p.first, p.last.toLocaleUpperCase('fr-FR'), ROLE_META[p.role].name, E.roleLabel(p, engineRole(p.role)), p.copies]));
        const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
        download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Equipe-handiplage_${today()}.csv`);
      }
      else if (act === 'replace-img') $('#fileImage').click();
    });

    $('#fileProject').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !Array.isArray(data.people)) throw new Error('format');
        const backup = JSON.stringify(state);
        state = mergeState(freshState(), data);
        for (const k of Object.keys(prepared)) delete prepared[k];
        ui.openId = null;
        save(); render(); prepareImages();
        toast(`Projet ouvert : ${plural(state.people.length, 'badge', 'badges')}.`, { action: { label: 'Annuler', run: () => { state = mergeState(freshState(), JSON.parse(backup)); save(); render(); prepareImages(); } } });
      } catch { toast('Ce fichier n’est pas un projet de badges valide (.json).', { warn: true }); }
    });
    $('#fileList').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      let text = await f.text();
      if (text.includes('�')) { try { text = new TextDecoder('windows-1252').decode(await f.arrayBuffer()); } catch { /* garde l'utf-8 */ } }
      setTab('team');
      $('#importBox').hidden = false; $('#importToggle').setAttribute('aria-expanded', 'true');
      $('#importText').value = text; $('#importText').dispatchEvent(new Event('input'));
      $('#importText').focus();
    });

    // Aperçu
    $('#viewSwitch').addEventListener('change', (e) => { ui.view = e.target.value; renderStage(); });
    $('#stageBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]'); if (b) openEditor(b.dataset.pick, { focus: true });
    });

    // Fonds
    const bgPanel = $('#panel-bg');
    const cur = () => state.roles[ui.bgRole];
    bgPanel.addEventListener('change', (e) => {
      const t = e.target, r = cur();
      if (t.name === 'bgRole') { ui.bgRole = t.value; renderBg(); return; }
      if (t.name === 'bgMode') {
        r.bg.mode = t.value;
        if (t.value === 'image' && !r.bg.image) { save(); render(); $('#fileImage').click(); return; }
      }
      else if (t.name === 'theme') { const th = THEMES.find((x) => x.id === t.value); r.bg.theme = th.id; r.bg.base = th.base.slice(); r.bg.motif = th.motif.slice(); }
      else if (t.name === 'textColor') r.text = t.value;
      else if (t.id === 'motifOnImage') r.bg.motifOnImage = t.checked;
      else if (t.id === 'roleBold') r.roleWeight = t.checked ? 600 : 300;
      else return;
      save(); render();
    });
    bgPanel.addEventListener('input', (e) => {
      const t = e.target, r = cur();
      if (t.dataset.cmyk) {
        const v = Math.max(0, Math.min(100, parseFloat(t.value.replace(',', '.')) || 0)) / 100;
        r.bg[t.dataset.cmyk][t.dataset.ch] = v; r.bg.theme = 'custom';
      }
      else if (t.id === 'veil') { r.bg.veil = +t.value / 100; $('#veilOut').textContent = `${t.value} %`; }
      else if (t.id === 'labelM') r.labelM = t.value;
      else if (t.id === 'labelF') r.labelF = t.value;
      else return;
      save(); render();
    });
    $('#bgCopyAll').addEventListener('click', () => {
      const src = cur();
      const backup = JSON.stringify(state.roles);
      for (const id of ROLE_IDS) if (id !== ui.bgRole) { state.roles[id].bg = JSON.parse(JSON.stringify(src.bg)); state.roles[id].text = src.text; }
      for (const k of Object.keys(prepared)) delete prepared[k];
      save(); render(); prepareImages();
      toast('Fond appliqué aux 3 fonctions. Les fonctions se distinguent alors par leur libellé.', { action: { label: 'Annuler', run: () => { state.roles = JSON.parse(backup); for (const k of Object.keys(prepared)) delete prepared[k]; save(); render(); prepareImages(); } } });
    });
    $('#bgReset').addEventListener('click', () => {
      const id = ui.bgRole, backup = JSON.stringify(state.roles[id]);
      state.roles[id] = defaultRole(id); delete prepared[id];
      save(); render();
      toast(`Fond d’origine rétabli pour ${ROLE_META[id].name}.`, { action: { label: 'Annuler', run: () => { state.roles[id] = JSON.parse(backup); save(); render(); prepareImages(); } } });
    });
    const drop = $('#drop');
    drop.addEventListener('click', () => $('#fileImage').click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileImage').click(); } });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); importImage(e.dataTransfer.files[0], ui.bgRole); });
    $('#fileImage').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importImage(f, ui.bgRole); else if (!cur().bg.image) { cur().bg.mode = 'pattern'; render(); } });

    // Impression
    $('#panel-print').addEventListener('change', (e) => {
      const t = e.target, pr = state.print;
      if (['format', 'layout', 'colorMode', 'order'].includes(t.name)) pr[t.name] = t.value;
      else if (t.id === 'bleed' || t.id === 'cropMarks') pr[t.id] = t.checked;
      else return;
      save(); render();
      if (t.name === 'format') prepareImages();
    });
    $('#exportBtn').addEventListener('click', exportPdf);
    $('#exportBtn2').addEventListener('click', exportPdf);
  }

  /* ---------- Démarrage ---------- */
  async function init() {
    document.body.insertAdjacentHTML('afterbegin', E.svgArtLibrary());
    const faces = [
      ['Badge Sans', 'sans400', { weight: '400' }], ['Badge Sans', 'sans600', { weight: '600' }], ['Badge Sans', 'sans700', { weight: '700' }],
      ['Badge Serif', 'role300i', { style: 'italic', weight: '300' }], ['Badge Serif', 'role600i', { style: 'italic', weight: '600' }],
    ];
    await Promise.all(faces.map(async ([fam, key, desc]) => {
      try { const f = new FontFace(fam, E.FONT_BYTES[key], desc); document.fonts.add(f); await f.load(); } catch (err) { console.warn('Police', key, err); }
    }));
    const mark = E.badgeSvg(EMPTY, silentRole(engineRole('accueil', defaultRole('accueil'))), null, '85x53', 'preserveAspectRatio="xMidYMid slice" aria-hidden="true"').svg;
    $('.brand-mark').innerHTML = mark;
    bind();
    setTab('team');
    renderNow();
    prepareImages();
  }
  init();
})();
