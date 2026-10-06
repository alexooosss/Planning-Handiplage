import React, { useState, useEffect, useMemo } from "react";
import { Info, Sparkles, ArrowRight, Image as ImageIcon, Printer, Loader2 } from "lucide-react";
import { PageHead, Panel, RoleDot, PersonName, Stepper } from "../ui.jsx";
import { pkey, fullName } from "../data.js";

const NAVY = "oklch(28% 0.08 268)";
export const THEMES = {
  marine: { name: "Marine", base: "oklch(27% 0.075 268)", motif: "oklch(33% 0.08 268)" },
  outremer: { name: "Outremer", base: "oklch(38% 0.19 273)", motif: NAVY },
  magenta: { name: "Magenta", base: "oklch(57% 0.245 352)", motif: NAVY },
  lagon: { name: "Lagon", base: "oklch(62% 0.12 205)", motif: NAVY },
  corail: { name: "Corail", base: "oklch(66% 0.17 32)", motif: NAVY },
  pin: { name: "Pin parasol", base: "oklch(52% 0.11 150)", motif: NAVY },
};
const BASE_STYLE = {
  mode: "pattern", custom: false, baseHex: "#1E2A54", motifHex: "#2A3666",
  waves: true, octopus: true, flipX: false, flipY: false,
  image: null, imageName: "", veil: 0.25, motifOnImage: false,
  text: "white", textHex: "#BCB08A",
  nameScale: 1, nameWeight: 600, align: "left", lastUpper: true, offsetY: 0,
  roleScale: 1, labelAlign: "right", bold: false,
  band: false, bandHex: "#BCB08A", bandH: 4,
};
export const DEFAULT_STYLES = {
  chef: { ...BASE_STYLE, theme: "outremer", labelM: "Chef d’équipe", labelF: "Cheffe d’équipe" },
  adm: { ...BASE_STYLE, theme: "magenta", labelM: "Hôte d’accueil", labelF: "Hôtesse d’accueil", bold: true },
  agent: { ...BASE_STYLE, theme: "marine", labelM: "Handiplagiste", labelF: "Handiplagiste" },
};
// Moteur de l'outil badges (public/badge-engine) : aperçu et PDF identiques à l'outil d'origine
const E = () => window.BadgeEngine;
const THEME_CMYK = () => {
  const C = E().COLORS, NAVY = C.navy.cmyk;
  return { marine: [NAVY, C.navyLight.cmyk], outremer: [C.blue.cmyk, NAVY], magenta: [C.magenta.cmyk, NAVY], lagon: [[0.92, 0.12, 0.32, 0.02], NAVY], corail: [[0, 0.74, 0.66, 0], NAVY], pin: [[0.82, 0.22, 0.85, 0.22], NAVY] };
};
// Couleur choisie au nuancier : RVB exact à l'écran, équivalent CMJN approché
const hexColor = (hex) => {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = rgb.map((v) => v / 255), k = 1 - Math.max(r, g, b);
  const cmyk = k >= 1 ? [0, 0, 0, 1] : [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
  return E().color(cmyk, rgb);
};
export function engineRole(style, silent) {
  const st = { ...BASE_STYLE, ...style };
  const [base, motif] = st.custom ? [null, null] : THEME_CMYK()[st.theme];
  return {
    labelM: silent ? "" : st.labelM, labelF: silent ? "" : st.labelF, roleWeight: st.bold ? 600 : 300, text: st.text === "navy" ? "navy" : "white",
    ink: st.text === "custom" ? hexColor(st.textHex) : null,
    layout: { nameScale: st.nameScale, roleScale: st.roleScale, align: st.align, nameFont: { 400: "sans400", 600: "sans600", 700: "sans700" }[st.nameWeight], lastUpper: st.lastUpper, labelAlign: st.labelAlign, offsetY: st.offsetY },
    band: st.band ? { h: st.bandH, color: hexColor(st.bandHex) } : null,
    bg: {
      mode: st.mode === "image" && !st.image ? "pattern" : st.mode,
      base: st.custom ? hexColor(st.baseHex) : E().colorFromCmyk(base), motif: st.custom ? hexColor(st.motifHex) : E().colorFromCmyk(motif),
      veil: st.veil, motifOnImage: st.motifOnImage, waves: st.waves, octopus: st.octopus, flipX: st.flipX, flipY: st.flipY,
    },
  };
}
// Image de fond recadrée au format du badge + fond perdu (comme l'outil d'origine)
const prepareImage = (dataUrl, fmtKey) => new Promise((res) => {
  const img = new Image();
  img.onload = () => {
    const f = E().FORMATS[fmtKey], bw = f.w + 2 * E().IMAGE_BLEED, bh = f.h + 2 * E().IMAGE_BLEED, ratio = bw / bh;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
    const cv = document.createElement("canvas"); cv.width = 900; cv.height = Math.round(900 / ratio);
    cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    res({ preview: cv.toDataURL("image/jpeg", 0.88), dpi: Math.round(sw / (bw / 25.4)) });
  };
  img.src = dataUrl;
});
const toPerson = (a) => ({ first: a.first, last: a.last, gender: a.gender, label: a.label || "" });
// Polices des badges (Rosario, Newsreader) chargées une fois, comme dans l'outil d'origine
function useBadgeEngine() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window.BadgeEngine) return;
    if (!window.__badgeReady) {
      const faces = [["Badge Sans", "sans400", { weight: "400" }], ["Badge Sans", "sans600", { weight: "600" }], ["Badge Sans", "sans700", { weight: "700" }], ["Badge Serif", "role300i", { style: "italic", weight: "300" }], ["Badge Serif", "role600i", { style: "italic", weight: "600" }]];
      window.__badgeReady = Promise.all(faces.map(async ([fam, key, desc]) => { try { const f = new FontFace(fam, E().FONT_BYTES[key], desc); document.fonts.add(f); await f.load(); } catch { /* police de secours */ } }))
        .then(() => document.body.insertAdjacentHTML("afterbegin", E().svgArtLibrary()));
    }
    window.__badgeReady.then(() => setReady(true));
  }, []);
  return ready;
}
function EngineBadge({ person, style, format = "85x53", silent, label, image }) {
  const html = E().badgeSvg(person || { first: "", last: "" }, engineRole(style, silent), style.mode === "image" ? image || null : null, format, label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"').svg;
  return <span className="eb" dangerouslySetInnerHTML={{ __html: html }} />;
}

const FORMATS = { "85x53": ["85 × 53 mm", "Vos badges 2026"], "86x54": ["85,6 × 54 mm", "Carte PVC CR80"], "90x55": ["90 × 55 mm", "Carte de visite"] };

export function BadgeSvg({ person, style }) {
  const art = window.BADGE_ART || { waves: "", octopus: "" };
  const th = THEMES[style.theme], ink = style.text === "white" ? "oklch(99% 0.004 85)" : "oklch(24% 0.062 266)";
  const label = person ? person.label || (person.gender === "f" ? style.labelF : style.labelM) : "";
  return (
    <svg viewBox="0 0 85 53" role={person ? "img" : undefined} aria-label={person ? `Badge de ${person.first} ${person.last}` : undefined} aria-hidden={person ? undefined : true}>
      <rect width="85" height="53" fill={th.base} />
      {style.mode === "pattern" && <><path d={art.waves} fill={th.motif} /><path d={art.octopus} fill={th.motif} /></>}
      {person && <>
        <text x="7" y="19" fill={ink} fontFamily="Atkinson Hyperlegible Next, sans-serif" fontWeight="600" fontSize="10.5">{person.first || "Prénom"}</text>
        <text x="7" y="29.5" fill={ink} fontFamily="Atkinson Hyperlegible Next, sans-serif" fontWeight="700" fontSize={person.last.length > 11 ? 6.4 : 8}>{(person.last || "NOM").toUpperCase()}</text>
        <text x="79" y="47" textAnchor="end" fill={ink} fontFamily="Georgia, serif" fontStyle="italic" fontWeight={style.bold ? 700 : 400} fontSize="5">{label}</text>
      </>}
    </svg>
  );
}

// Contrôles du configurateur (définis hors du composant pour rester stables pendant un glissement)
const Seg = ({ S, set, k, opts }) => <div className="seg wide sm" role="group">{opts.map(([v, l]) => <button key={String(v)} aria-pressed={S[k] === v} onClick={() => set({ [k]: v })}>{l}</button>)}</div>;
const Range = ({ S, set, k, min, max, step, fmt }) => <div className="range"><input type="range" min={min} max={max} step={step} value={S[k]} onChange={(e) => set({ [k]: +e.target.value })} aria-label={k} /><output className="num">{fmt(S[k])}</output></div>;
const Color = ({ S, set, k, label }) => <label className="color-field"><input type="color" value={S[k]} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} /><span>{label}<b className="num">{S[k]}</b></span></label>;

export const DEFAULT_PRINT = { format: "85x53", layout: "sheet", color: "cmyk", bleed: true, marks: true, order: "role" };
/** Badge à jour si le nom imprimé la dernière fois est le nom actuel de la personne. */
export function badgeStatus(a, badges) {
  const printed = badges?.log?.[pkey(a)];
  if (!printed) return "missing";
  return printed === fullName(a) ? "ok" : "outdated";
}

export default function Badges({ team: monthTeam, badges, setBadges, say }) {
  const [tab, setTab] = useState("team");
  const [role, setRole] = useState("agent");
  // Tout est enregistré avec la saison : styles, réglages d'impression, préférences par personne, badges imprimés
  const styles = badges.styles || DEFAULT_STYLES;
  const setStyles = (v) => setBadges((b) => ({ ...b, styles: typeof v === "function" ? v(b.styles || DEFAULT_STYLES) : v }));
  const print = { ...DEFAULT_PRINT, ...(badges.print || {}) };
  const setPrint = (v) => setBadges((b) => ({ ...b, print: v }));
  const team = monthTeam.filter((a) => a.first || a.last).map((a) => ({ gender: "m", copies: 1, label: "", ...(badges.prefs?.[pkey(a)] || {}), ...a, badge: badgeStatus(a, badges) }));
  const setTeam = (fn) => {
    const next = typeof fn === "function" ? fn(team) : fn;
    setBadges((b) => {
      const prefs = { ...(b.prefs || {}) }, log = { ...(b.log || {}) };
      next.forEach((a) => { prefs[pkey(a)] = { gender: a.gender, copies: a.copies, label: a.label }; if (a.badge === "ok") log[pkey(a)] = fullName(a); });
      return { ...b, prefs, log };
    });
  };
  const upd = (id, patch) => setTeam((t) => t.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const todo = team.filter((a) => a.badge !== "ok");
  const order = { chef: 0, adm: 1, agent: 2 };
  const sorted = print.order === "role" ? [...team].sort((a, b) => order[a.role] - order[b.role] || a.last.localeCompare(b.last)) : team;
  const count = team.reduce((s, a) => s + (a.copies || 1), 0);
  const pages = print.layout === "sheet" ? Math.ceil(count / 8) : count;
  const st = styles[role], setSt = (patch) => setStyles({ ...styles, [role]: { ...st, ...patch } });
  const P = (k, v) => setPrint({ ...print, [k]: v });
  const ready = useBadgeEngine();
  const [prepared, setPrepared] = useState({});
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    Promise.all(["chef", "adm", "agent"].map(async (r) => [r, styles[r].image ? await prepareImage(styles[r].image, print.format) : null]))
      .then((list) => alive && setPrepared(Object.fromEntries(list)));
    return () => { alive = false; };
  }, [ready, print.format, styles.chef.image, styles.adm.image, styles.agent.image]);
  const imgFor = (r) => (styles[r].mode === "image" ? prepared[r] || null : null);
  const onImage = (file) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { say("Choisissez une image JPG ou PNG."); return; }
    const fr = new FileReader();
    fr.onload = () => setSt({ image: fr.result, imageName: file.name, mode: "image" });
    fr.readAsDataURL(file);
  };
  const [view, setView] = useState("badges");
  const printE = { format: print.format, layout: print.layout, colorMode: print.color, bleed: print.bleed, cropMarks: print.marks, order: print.order };
  const items = useMemo(() => (ready ? sorted.flatMap((a) => Array.from({ length: a.copies || 1 }, () => ({ person: toPerson(a), role: engineRole(styles[a.role]), imageKey: imgFor(a.role) ? a.role : null }))) : []), [ready, sorted, styles]);
  const sheets = ready ? E().paginate(items, printE) : [];
  // Impression dans l'interface : la fenêtre du navigateur propose aussi « Enregistrer au format PDF »
  const printNow = () => {
    const size = E().pageSize(printE);
    let st = document.getElementById("badge-page-size");
    if (!st) { st = document.createElement("style"); st.id = "badge-page-size"; document.head.appendChild(st); }
    st.textContent = `@media print { @page { size: ${size.w}mm ${size.h}mm; margin: 0; } .badge-print-page { width: ${size.w}mm; height: ${size.h}mm; } }`;
    document.body.dataset.print = "badges";
    window.print();
    setTeam((t) => t.map((x) => ({ ...x, badge: "ok" })));
    setTimeout(() => { delete document.body.dataset.print; st.textContent = ""; }, 500);
  };

  return (
    <>
      <PageHead title="Badges nominatifs" sub={`${count} badges · ${pages} ${print.layout === "sheet" ? "planche(s) A4" : "page(s)"} · ${FORMATS[print.format][0]} · ${print.color === "cmyk" ? "CMJN imprimeur" : "RVB bureau"}`}>
      </PageHead>
      {todo.length > 0 && <div className="todo"><button className="todo-item magenta" onClick={() => { const beforeB = badges; setTeam((t) => t.map((a) => ({ ...a, badge: "ok" }))); say(`${todo.length} badges marqués comme créés.`, () => setBadges(beforeB)); }}><Sparkles size={16} />{todo.length} personne(s) de l’équipe sans badge à jour · tout créer<ArrowRight size={15} className="arrow" /></button></div>}

      <div className="badge-layout">
        <div className="stack">
          <div className="seg wide" role="tablist" aria-label="Réglages">
            {[["team", "1 · Équipe"], ["bg", "2 · Style"], ["print", "3 · Impression"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === "team" && (
            <Panel title="Depuis l’équipe" right={<span className="muted small">noms synchronisés</span>} flush>
              {sorted.map((a) => {
                const s = styles[a.role];
                return (
                  <div className="badge-person" key={a.id}>
                    <div className="bp-top"><RoleDot role={a.role} /><PersonName a={a} />
                      {a.badge === "ok" ? <span className="chip ok">à jour</span> : a.badge === "outdated" ? <span className="chip warn" title="Le nom a changé depuis l’impression">nom modifié</span> : <span className="chip magenta">à créer</span>}
                    </div>
                    <div className="bp-opts">
                      {s.labelM !== s.labelF ? (
                        <div className="seg sm" role="group" aria-label="Accord du libellé">
                          <button aria-pressed={a.gender !== "f"} onClick={() => upd(a.id, { gender: "m" })}>{s.labelM}</button>
                          <button aria-pressed={a.gender === "f"} onClick={() => upd(a.id, { gender: "f" })}>{s.labelF}</button>
                        </div>
                      ) : <span className="muted small">{s.labelM}</span>}
                      <Stepper value={a.copies || 1} min={1} max={20} onChange={(v) => upd(a.id, { copies: v })} format={(v) => `×${v}`} label="Exemplaires" />
                    </div>
                    <input className="inline-input bp-label" value={a.label || ""} placeholder={`Libellé personnalisé (sinon « ${a.gender === "f" ? s.labelF : s.labelM} »)`} aria-label={`Libellé personnalisé de ${a.first}`} onChange={(e) => upd(a.id, { label: e.target.value })} />
                  </div>
                );
              })}
            </Panel>
          )}

          {tab === "bg" && (() => {
            const S = { ...BASE_STYLE, ...st };
            return (
              <Panel title="Personnaliser par fonction">
                <div className="seg wide" role="group" aria-label="Fonction">
                  {[["chef", "Chef·fe"], ["adm", "Accueil"], ["agent", "Handiplagiste"]].map(([k, l]) => <button key={k} aria-pressed={role === k} onClick={() => setRole(k)}><RoleDot role={k} />{l}</button>)}
                </div>
                <div className="bg-preview">{ready && <EngineBadge person={{ first: "Prénom", last: "Nom", gender: "f", label: "" }} style={st} image={prepared[role]} format={print.format} label="Aperçu" />}</div>

                <details className="cust" open>
                  <summary>Fond</summary>
                  <Seg S={S} set={setSt} k="mode" opts={[["pattern", "Motif vagues"], ["solid", "Couleur unie"], ["image", "Image"]]} />
                  {S.mode !== "image" && <>
                    <span className="field-label">Couleurs</span>
                    <div className="themes">
                      {Object.entries(THEMES).map(([k, t]) => <button key={k} className="theme" aria-pressed={!S.custom && S.theme === k} onClick={() => setSt({ theme: k, custom: false })}>{ready && <EngineBadge style={{ ...st, theme: k, custom: false }} silent />}<span>{t.name}</span></button>)}
                      <button className="theme" aria-pressed={S.custom} onClick={() => setSt({ custom: true })}>{ready && <EngineBadge style={{ ...st, custom: true }} silent />}<span>Sur mesure</span></button>
                    </div>
                    {S.custom && <div className="color-row"><Color S={S} set={setSt} k="baseHex" label="Fond" />{S.mode === "pattern" && <Color S={S} set={setSt} k="motifHex" label="Motif" />}</div>}
                  </>}
                  {S.mode === "image" && <>
                    <label className="drop-zone">
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { onImage(e.target.files[0]); e.target.value = ""; }} />
                      <ImageIcon size={18} />{S.image ? <span><b>{S.imageName || "Image importée"}</b> · remplacer</span> : <span><b>Choisir une image</b> · JPG ou PNG, 1100 × 700 px minimum</span>}
                    </label>
                    {prepared[role] && <p className={`small ${prepared[role].dpi >= 250 ? "ok-txt" : "field-error"}`}>{prepared[role].dpi >= 250 ? `Qualité impression : ${prepared[role].dpi} dpi` : `Résolution faible : ${prepared[role].dpi} dpi (300 conseillés)`}</p>}
                    <span className="field-label">Assombrir pour la lisibilité</span>
                    <Range S={S} set={setSt} k="veil" min={0} max={0.7} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} />
                    <label className="check"><input type="checkbox" checked={S.motifOnImage} onChange={(e) => setSt({ motifOnImage: e.target.checked })} />Garder le motif par-dessus</label>
                    {S.motifOnImage && <div className="color-row"><Color S={S} set={setSt} k="motifHex" label="Motif" /></div>}
                  </>}
                  {(S.mode === "pattern" || S.motifOnImage) && <>
                    <span className="field-label">Motif</span>
                    <div className="check-row">
                      <label className="check"><input type="checkbox" checked={S.waves} onChange={(e) => setSt({ waves: e.target.checked })} />Vagues</label>
                      <label className="check"><input type="checkbox" checked={S.octopus} onChange={(e) => setSt({ octopus: e.target.checked })} />Pieuvre</label>
                      <label className="check"><input type="checkbox" checked={S.flipX} onChange={(e) => setSt({ flipX: e.target.checked })} />Miroir ↔</label>
                      <label className="check"><input type="checkbox" checked={S.flipY} onChange={(e) => setSt({ flipY: e.target.checked })} />Miroir ↕</label>
                    </div>
                  </>}
                </details>

                <details className="cust" open>
                  <summary>Prénom et nom</summary>
                  <span className="field-label">Couleur du texte</span>
                  <Seg S={S} set={setSt} k="text" opts={[["white", "Blanc"], ["navy", "Marine"], ["custom", "Sur mesure"]]} />
                  {S.text === "custom" && <div className="color-row"><Color S={S} set={setSt} k="textHex" label="Texte" /></div>}
                  <span className="field-label">Taille</span>
                  <Range S={S} set={setSt} k="nameScale" min={0.7} max={1.25} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} />
                  <span className="field-label">Épaisseur</span>
                  <Seg S={S} set={setSt} k="nameWeight" opts={[[400, "Normal"], [600, "Gras"], [700, "Très gras"]]} />
                  <span className="field-label">Alignement</span>
                  <Seg S={S} set={setSt} k="align" opts={[["left", "Gauche"], ["center", "Centré"], ["right", "Droite"]]} />
                  <span className="field-label">Position verticale</span>
                  <Range S={S} set={setSt} k="offsetY" min={-4} max={6} step={0.5} fmt={(v) => (v === 0 ? "origine" : `${v > 0 ? "+" : ""}${v} mm`)} />
                  <label className="check"><input type="checkbox" checked={S.lastUpper} onChange={(e) => setSt({ lastUpper: e.target.checked })} />Nom de famille en MAJUSCULES</label>
                </details>

                <details className="cust" open>
                  <summary>Libellé de la fonction</summary>
                  <div className="form-row">
                    <label className="field"><span className="field-label">Masculin</span><input className="input" value={S.labelM} onChange={(e) => setSt({ labelM: e.target.value })} /></label>
                    <label className="field"><span className="field-label">Féminin</span><input className="input" value={S.labelF} onChange={(e) => setSt({ labelF: e.target.value })} /></label>
                  </div>
                  <span className="field-label">Taille</span>
                  <Range S={S} set={setSt} k="roleScale" min={0.7} max={1.3} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} />
                  <span className="field-label">Position</span>
                  <Seg S={S} set={setSt} k="labelAlign" opts={[["left", "Gauche"], ["center", "Centré"], ["right", "Droite"]]} />
                  <label className="check"><input type="checkbox" checked={S.bold} onChange={(e) => setSt({ bold: e.target.checked })} />Libellé en gras</label>
                </details>

                <details className="cust">
                  <summary>Bandeau de couleur</summary>
                  <label className="check"><input type="checkbox" checked={S.band} onChange={(e) => setSt({ band: e.target.checked })} />Ajouter un bandeau en bas du badge</label>
                  {S.band && <>
                    <div className="color-row"><Color S={S} set={setSt} k="bandHex" label="Bandeau" /></div>
                    <span className="field-label">Hauteur</span>
                    <Range S={S} set={setSt} k="bandH" min={2} max={12} step={0.5} fmt={(v) => `${v} mm`} />
                  </>}
                </details>

                <div className="cust-foot">
                  <button className="btn btn-ghost btn-sm" onClick={() => { const { labelM, labelF, ...look } = S; setStyles({ chef: { ...styles.chef, ...look }, adm: { ...styles.adm, ...look }, agent: { ...styles.agent, ...look } }); say("Apparence appliquée aux 3 fonctions (les libellés restent propres à chacune)."); }}>Appliquer aux 3 fonctions</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => { const before = styles; setStyles({ ...styles, [role]: DEFAULT_STYLES[role] }); say("Badge d’origine rétabli pour cette fonction.", () => setStyles(before)); }}>Rétablir l’original</button>
                </div>
              </Panel>
            );
          })()}

          {tab === "print" && (
            <Panel title="Impression">
              <span className="field-label">Format du badge</span>
              <div className="choices">{Object.entries(FORMATS).map(([k, [l, h]]) => <button key={k} className="choice" aria-pressed={print.format === k} onClick={() => P("format", k)}><b>{l}</b><span>{h}</span></button>)}</div>
              <span className="field-label">Mise en page</span>
              <div className="choices"><button className="choice" aria-pressed={print.layout === "sheet"} onClick={() => P("layout", "sheet")}><b>Planche A4 · 8 badges</b><span>Imprimer au bureau puis découper</span></button><button className="choice" aria-pressed={print.layout === "single"} onClick={() => P("layout", "single")}><b>1 badge par page</b><span>Imprimeur ou imprimante PVC</span></button></div>
              <span className="field-label">Couleurs du PDF</span>
              <div className="choices"><button className="choice" aria-pressed={print.color === "cmyk"} onClick={() => P("color", "cmyk")}><b>CMJN · imprimeur</b><span>Couleurs exactes de vos fichiers Illustrator</span></button><button className="choice" aria-pressed={print.color === "rgb"} onClick={() => P("color", "rgb")}><b>RVB · bureau</b><span>Plus vif sur jet d’encre ou laser</span></button></div>
              <span className="field-label">Découpe</span>
              <label className="check"><input type="checkbox" checked={print.bleed} onChange={(e) => P("bleed", e.target.checked)} />Fond perdu de 2 mm</label>
              <div className="note"><Info size={16} /><span>{print.bleed ? "Le motif dépasse de 2 mm au-delà des traits de coupe, en miroir. C’est normal à l’écran : cette marge disparaît à la découpe." : "Sans fond perdu, le PDF ressemble exactement à l’aperçu. Idéal pour découper soi-même."}</span></div>
              <label className="check"><input type="checkbox" checked={print.marks} onChange={(e) => P("marks", e.target.checked)} />Traits de coupe</label>
              <span className="field-label">Ordre</span>
              <div className="seg sm"><button aria-pressed={print.order === "role"} onClick={() => P("order", "role")}>Par fonction</button><button aria-pressed={print.order === "entry"} onClick={() => P("order", "entry")}>Ordre de l’équipe</button></div>
              <div className="note warn"><Info size={16} /><span>À l’impression : <b>Taille réelle (100 %)</b>, décochez « Ajuster à la page ».</span></div>
              <button className="btn btn-primary" disabled={!ready} onClick={printNow}><Printer size={17} />Imprimer ou enregistrer en PDF</button>
            </Panel>
          )}
        </div>

        <section aria-label="Aperçu">
          <div className="preview-bar">
            <div className="seg" role="group" aria-label="Affichage">
              <button aria-pressed={view === "badges"} onClick={() => setView("badges")}>Badges</button>
              <button aria-pressed={view === "sheets"} onClick={() => setView("sheets")}>{print.layout === "sheet" ? "Planches A4" : "Pages"} · {sheets.length}</button>
            </div>
            <span className="muted small">{print.bleed ? "Fond perdu 2 mm" : "Sans fond perdu"}{print.marks ? " · traits de coupe" : ""} · {print.color === "cmyk" ? "CMJN" : "RVB"}</span>
          </div>
          {!ready ? <div className="panel empty-state"><Loader2 size={22} className="spin" /><p>Chargement des polices des badges…</p></div>
            : view === "badges" ? (
              <div className="badge-grid">
                {sorted.flatMap((a) => Array.from({ length: a.copies || 1 }, (_, i) => (
                  <figure key={a.id + i} className={`badge-card${a.badge === "missing" ? " missing" : ""}`}>
                    <EngineBadge person={toPerson(a)} style={styles[a.role]} image={prepared[a.role]} format={print.format} label={`Badge de ${a.first} ${a.last}`} />
                    <figcaption><RoleDot role={a.role} />{a.first} {a.last.toUpperCase()}{(a.copies || 1) > 1 && <span className="chip neutral">{i + 1}/{a.copies}</span>}{a.badge !== "ok" && <span className={`chip ${a.badge === "missing" ? "magenta" : "warn"}`} style={{ marginLeft: "auto" }}>{a.badge === "missing" ? "à créer" : "à réimprimer"}</span>}</figcaption>
                  </figure>
                )))}
              </div>
            ) : (
              <div className={`sheets${print.layout === "single" ? " single" : ""}`}>
                {sheets.map((pg, i) => (
                  <figure className="badge-sheet" key={i}>
                    <figcaption><b>{print.layout === "sheet" ? "Planche" : "Page"} {i + 1} / {sheets.length}</b><span>{pg.length} badge{pg.length > 1 ? "s" : ""}</span></figcaption>
                    <div className="sheet-page" dangerouslySetInnerHTML={{ __html: E().pageSvg(pg, printE, { imageFor: (it) => (it.imageKey ? prepared[it.imageKey] : null), slug: null }, `role="img" aria-label="${print.layout === "sheet" ? "Planche" : "Page"} ${i + 1}"`) }} />
                  </figure>
                ))}
              </div>
            )}
        </section>
      </div>
      {ready && (
        <div className="print-doc badge-print" data-doc="badges" aria-hidden="true">
          {sheets.map((pg, i) => <div key={i} className="badge-print-page" dangerouslySetInnerHTML={{ __html: E().pageSvg(pg, printE, { imageFor: (it) => (it.imageKey ? prepared[it.imageKey] : null), slug: null }) }} />)}
        </div>
      )}
    </>
  );
}
