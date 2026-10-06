import React, { useState } from "react";
import { Eye, EyeOff, Plus, RefreshCw, Trash2, UserPlus, Printer, AlertTriangle } from "lucide-react";
import { fullName, pkey } from "../data.js";
import { PageHead, Panel } from "../ui.jsx";

const pw = () => Math.random().toString(36).slice(2, 7);

export default function Comptes({ accounts, setAccounts, allPeople, say }) {
  const [show, setShow] = useState({});
  const upd = (i, patch) => setAccounts((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const missing = allPeople.filter((p) => !accounts.some((c) => c.pkey === pkey(p)));
  const createAll = () => {
    const taken = new Set(accounts.map((x) => x.id));
    const add = missing.map((p) => {
      const base = p.first.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") || "agent";
      let id = base, k = 1; while (taken.has(id)) id = base + ++k; taken.add(id);
      return { id, password: pw(), role: "user", name: fullName(p), pkey: pkey(p) };
    });
    setAccounts((a) => [...a, ...add]);
    say(`${add.length} comptes créés. Identifiants visibles ci-dessous, à imprimer ou transmettre.`);
  };
  // Fiches à découper, une par agent (le compte administrateur n'est jamais imprimé)
  const printable = accounts.filter((c) => c.role === "user" && c.id && c.password);
  const printIds = () => {
    if (!printable.length) { say("Aucun compte agent à imprimer."); return; }
    let st = document.getElementById("ids-page-size");
    if (!st) { st = document.createElement("style"); st.id = "ids-page-size"; document.head.appendChild(st); }
    st.textContent = "@media print { @page { size: A4 portrait; margin: 10mm; } }";
    document.body.dataset.print = "ids";
    window.print();
    setTimeout(() => { delete document.body.dataset.print; st.textContent = ""; }, 500);
  };
  const remove = (i) => {
    const t = accounts[i];
    if (t.role === "admin" && accounts.filter((x) => x.role === "admin").length <= 1) { say("Il faut garder au moins un compte administrateur."); return; }
    const before = accounts; setAccounts((a) => a.filter((_, j) => j !== i)); say(`Compte « ${t.id} » supprimé.`, () => setAccounts(before));
  };
  return (
    <>
      <PageHead title="Comptes" sub="Administrateur : accès complet. Agent : consulte son planning, les événements, et envoie ses demandes d’échange ou de congé.">
        <button className="btn btn-ghost btn-sm" onClick={printIds}><Printer size={15} />Imprimer les identifiants ({printable.length})</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAccounts((a) => [...a, { id: "", password: pw(), role: "user", name: "", pkey: null }])}><Plus size={15} />Ajouter un compte</button>
        <button className="btn btn-primary btn-sm" disabled={!missing.length} onClick={createAll}><UserPlus size={15} />{missing.length ? `Créer les ${missing.length} comptes manquants` : "Toute l’équipe a un compte"}</button>
      </PageHead>
      {missing.length > 0 && <div className="note warn"><AlertTriangle size={16} /><span>Sans compte : {missing.map((p) => `${p.first} ${p.last.toUpperCase()}`).join(", ")}.</span></div>}
      <Panel flush>
        <div style={{ overflowX: "auto" }}>
          <table className="data">
            <thead><tr><th>Identifiant</th><th>Mot de passe</th><th>Rôle</th><th>Personne liée</th><th className="r"><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {accounts.map((c, i) => (
                <tr key={i}>
                  <td><input className="inline-input num" value={c.id} placeholder="identifiant" aria-label="Identifiant" onChange={(e) => upd(i, { id: e.target.value })} style={{ width: 150 }} /></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input className="inline-input num" type={show[i] ? "text" : "password"} value={c.password} aria-label="Mot de passe" onChange={(e) => upd(i, { password: e.target.value })} style={{ width: 120 }} />
                      <button className="icon-btn" aria-label={show[i] ? "Masquer" : "Afficher"} onClick={() => setShow({ ...show, [i]: !show[i] })}>{show[i] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button className="icon-btn" aria-label="Nouveau mot de passe" title="Générer un nouveau mot de passe" onClick={() => { upd(i, { password: pw() }); setShow({ ...show, [i]: true }); }}><RefreshCw size={15} /></button>
                    </div>
                  </td>
                  <td><select className="select" value={c.role} onChange={(e) => upd(i, { role: e.target.value })} aria-label="Rôle"><option value="admin">Administrateur</option><option value="user">Agent</option></select></td>
                  <td>
                    {c.role === "admin" ? <input className="inline-input" value={c.name} placeholder="Nom affiché" aria-label="Nom affiché" onChange={(e) => upd(i, { name: e.target.value })} />
                      : <select className="select" value={c.pkey || ""} onChange={(e) => { const p = allPeople.find((x) => pkey(x) === e.target.value); upd(i, { pkey: p ? pkey(p) : null, name: p ? fullName(p) : "" }); }} aria-label="Personne liée">
                        <option value="">Choisir dans l’équipe…</option>
                        {allPeople.map((p) => <option key={pkey(p)} value={pkey(p)}>{p.first} {p.last.toUpperCase()}</option>)}
                      </select>}
                    {c.role === "user" && !allPeople.some((p) => pkey(p) === c.pkey) && <span className="chip warn" style={{ marginLeft: 8 }}>non relié</span>}
                  </td>
                  <td className="r"><button className="icon-btn" aria-label={`Supprimer ${c.id}`} onClick={() => remove(i)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="print-doc ids-print" data-doc="ids" aria-hidden="true">
        <div className="ids-head"><img src={`${import.meta.env.BASE_URL}logo-light.svg`} alt="" /><span>Identifiants de connexion · à découper et remettre à chaque agent</span></div>
        <div className="ids-grid">
          {printable.map((c) => (
            <div className="id-card" key={c.id}>
              <img src={`${import.meta.env.BASE_URL}logo-light.svg`} alt="" />
              <b className="id-name">{c.name || "Agent"}</b>
              <dl>
                <dt>Adresse</dt><dd>alexooosss.github.io/Planning-Handiplage</dd>
                <dt>Identifiant</dt><dd className="num">{c.id}</dd>
                <dt>Mot de passe</dt><dd className="num">{c.password}</dd>
              </dl>
              <p>Choisissez « Agent » à la connexion. Changez votre mot de passe dans « Mon profil ».</p>
            </div>
          ))}
        </div>
      </div>
      <p className="hint">Un compte agent est relié à une personne de l’équipe : c’est ce qui lui affiche son planning. Plus besoin de recopier le nom exact.</p>
    </>
  );
}
