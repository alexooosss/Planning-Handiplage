import React, { useState } from "react";
import { X, Sun, Moon, Check } from "lucide-react";
import { Avatar } from "../ui.jsx";

export default function Profile({ session, profile, setProfile, changePassword, onClose }) {
  const [email, setEmail] = useState(profile.email || "");
  const [photo, setPhoto] = useState(profile.photo || "");
  const [pw, setPw] = useState({ cur: "", next: "", conf: "" });
  const [msg, setMsg] = useState(null);
  const [saved, setSaved] = useState(false);
  const savePw = () => {
    if (!pw.next || pw.next !== pw.conf) return setMsg({ ok: false, t: "Les nouveaux mots de passe ne correspondent pas." });
    if (pw.next.length < 4) return setMsg({ ok: false, t: "4 caractères minimum." });
    const e = changePassword(pw.cur, pw.next);
    setMsg(e ? { ok: false, t: e } : { ok: true, t: "Mot de passe mis à jour." });
    if (!e) setPw({ cur: "", next: "", conf: "" });
  };
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="drawer" aria-label="Mon profil" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><h2>Mon profil</h2><div className="right"><button className="icon-btn" aria-label="Fermer" onClick={onClose}><X size={18} /></button></div></div>
        <div className="panel-body">
          <div className="insp-who"><Avatar a={{ id: session.id, name: session.name, first: session.name.split(" ")[0], last: session.name.split(" ")[1] || "" }} size={52} photo={photo} /><div><h3>{session.name}</h3><p>{session.role === "admin" ? "Administrateur" : "Agent"} · identifiant {session.id}</p></div></div>
          <label className="field"><span className="field-label">E-mail</span><input className="input" type="email" value={email} placeholder="prenom.nom@exemple.fr" onChange={(e) => setEmail(e.target.value)} /><span className="hint">Visible par l’administrateur. Sert à recevoir le planning publié.</span></label>
          <label className="field"><span className="field-label">Photo (adresse d’une image, facultatif)</span><input className="input" value={photo} placeholder="https://…" onChange={(e) => setPhoto(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={() => { setProfile({ ...profile, email, photo }); setSaved(true); setTimeout(() => setSaved(false), 1800); }}>{saved ? <><Check size={16} />Enregistré</> : "Enregistrer le profil"}</button>

          <span className="field-label">Apparence</span>
          <div className="seg wide" role="group" aria-label="Apparence">
            <button aria-pressed={!profile.dark} onClick={() => setProfile({ ...profile, dark: false })}><Sun size={15} />Clair</button>
            <button aria-pressed={!!profile.dark} onClick={() => setProfile({ ...profile, dark: true })}><Moon size={15} />Sombre</button>
          </div>

          <details className="pw">
            <summary>Changer le mot de passe</summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <input className="input" type="password" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
              <input className="input" type="password" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <input className="input" type="password" placeholder="Confirmer" aria-label="Confirmer le mot de passe" value={pw.conf} onChange={(e) => setPw({ ...pw, conf: e.target.value })} />
              {msg && <p className={msg.ok ? "ok-txt" : "field-error"} role="status">{msg.t}</p>}
              <button className="btn btn-ghost" onClick={savePw}>Mettre à jour</button>
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}
