// app.js — données (Supabase), lecture image par image, annotation, enregistrement, export
import { createViewer } from './viewer.js';

const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// ---------- État ----------
const etat = {
  sujets: [], visites: [], essais: [],
  essai: null,          // ligne de la table essais
  visite: null, sujet: null,
  essaiJson: null,      // contenu du fichier JSON
  cacheJson: new Map(),
  evenements: [],       // {id, pied: 'G'|'D', type: 'pose'|'lever', image}
  image: 0,
  lecture: false,
  vitesse: 1,
  modifie: false,
  annulations: [],      // pile Ctrl+Z
};

const $ = id => document.getElementById(id);

// ---------- Aides ----------
function nbImages() { return etat.essaiJson ? etat.essaiJson.nb_images : 0; }
function frequence() { return etat.essaiJson ? etat.essaiJson.frequence_hz : 100; }
function tempsImage(i) { return i / frequence(); }

function fmt2(x) { return x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtTemps(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t % 1) * 100);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function toast(message, erreur = false) {
  const t = $('toast');
  t.textContent = message;
  t.classList.toggle('erreur', erreur);
  t.hidden = false;
  clearTimeout(toast._min);
  toast._min = setTimeout(() => { t.hidden = true; }, 2500);
}

// ---------- Chargement des données ----------
async function chargerDonnees() {
  const [s, v, e] = await Promise.all([
    db.from('sujets').select('*').order('code'),
    db.from('visites').select('*').order('numero'),
    db.from('essais').select('*').order('numero'),
  ]);
  if (s.error || v.error || e.error) throw s.error || v.error || e.error;
  etat.sujets = s.data; etat.visites = v.data; etat.essais = e.data;
}

function essaisDeSujet(sujetId) {
  const visites = etat.visites.filter(v => v.sujet_id === sujetId);
  return etat.essais.filter(e => visites.some(v => v.id === e.visite_id));
}

function afficherSidebar() {
  const cont = $('liste-sujets');
  cont.innerHTML = '';
  for (const sujet of etat.sujets) {
    const essais = essaisDeSujet(sujet.id);
    const rS = document.createElement('div');
    rS.className = 'rangée-sujet';
    rS.innerHTML = `<span>${sujet.code}</span><span class="badge-compte">${essais.length} essai${essais.length > 1 ? 's' : ''}</span>
      <button class="bouton-mini-ajout" title="Nouvelle visite">+ visite</button>`;
    rS.querySelector('.bouton-mini-ajout').addEventListener('click', ev => {
      ev.stopPropagation();
      ouvrirDialogue('visite', sujet);
    });
    cont.appendChild(rS);

    for (const visite of etat.visites.filter(v => v.sujet_id === sujet.id)) {
      const date = visite.date_visite
        ? ' · ' + visite.date_visite.split('-').reverse().join('/')
        : '';
      const rV = document.createElement('div');
      rV.className = 'rangée-visite';
      rV.innerHTML = `<span>Visite ${visite.numero}${date}</span><button class="bouton-mini-ajout" title="Nouvel essai">+ essai</button>`;
      rV.querySelector('.bouton-mini-ajout').addEventListener('click', ev => {
        ev.stopPropagation();
        ouvrirDialogue('essai', visite);
      });
      cont.appendChild(rV);

      for (const essai of etat.essais.filter(e => e.visite_id === visite.id)) {
        const rE = document.createElement('div');
        rE.className = 'rangée-essai' + (etat.essai && etat.essai.id === essai.id ? ' selectionnee' : '');
        rE.innerHTML = `<span>Essai ${essai.numero}</span><span class="etiquette-statut statut-${essai.statut}">${essai.statut}</span>`;
        rE.addEventListener('click', () => choisirEssai(essai));
        cont.appendChild(rE);
      }
    }
  }
}

// ---------- Sélection d'un essai ----------
async function choisirEssai(essai) {
  try {
    const visite = etat.visites.find(v => v.id === essai.visite_id);
    const sujet = etat.sujets.find(s => s.id === visite.sujet_id);

    if (!etat.cacheJson.has(essai.fichier)) {
      const rep = await fetch('essais/' + essai.fichier);
      if (!rep.ok) throw new Error('fichier introuvable : ' + essai.fichier);
      etat.cacheJson.set(essai.fichier, await rep.json());
    }
    const json = etat.cacheJson.get(essai.fichier);

    const { data: evts, error } = await db.from('evenements')
      .select('*').eq('essai_id', essai.id).order('image');
    if (error) throw error;

    etat.essai = essai; etat.visite = visite; etat.sujet = sujet;
    etat.essaiJson = json;
    etat.evenements = evts.map(e => ({ id: e.id, pied: e.pied, type: e.type, image: e.image }));
    etat.image = 0;
    etat.lecture = false;
    etat.modifie = false;
    etat.annulations = [];
    boutonLecture();

    $('titre-essai').textContent = `${sujet.code} · Visite ${visite.numero} · Essai ${essai.numero}`;
    const duree = (json.nb_images - 1) / json.frequence_hz;
    $('sous-titre-essai').textContent =
      `${json.nb_images} images · ${json.frequence_hz} Hz · ${fmt2(duree)} s`;
    $('carte-info').hidden = false;
    $('btn-export').disabled = false;
    $('btn-enregistrer').disabled = false;
    $('btn-enregistrer').classList.remove('modifie');

    viewer.loadTrial(json);
    viewer.setFrame(0);
    afficherTout();
    afficherSidebar();
  } catch (err) {
    toast('Erreur au chargement : ' + (err.message || err), true);
  }
}

// ---------- Affichage global ----------
function afficherTout() {
  afficherCarteInfo();
  afficherTemps();
  afficherEvenements();
  dessinerPistes();
  calculerParametres();
}

function afficherCarteInfo() {
  const i = etat.image;
  $('info-image').textContent = i;
  $('info-total').textContent = nbImages() - 1;
  $('info-temps').textContent = fmt2(tempsImage(i)) + ' s';
  for (const pied of ['G', 'D']) {
    const el = $(pied === 'G' ? 'info-gauche' : 'info-droit');
    const st = etatPied(pied, i);
    el.textContent = st;
    el.className = st === 'au sol' ? 'au-sol' : st === 'levé' ? 'levé' : '';
  }
}

function etatPied(pied, i) {
  // au sol entre un pose et le lever suivant ; sinon levé
  const evts = etat.evenements.filter(e => e.pied === pied).sort((a, b) => a.image - b.image);
  let st = 'levé';
  let vu = false;
  for (const e of evts) {
    if (e.type === 'pose' && e.image <= i) { st = 'au sol'; vu = true; }
    if (e.type === 'lever' && e.image <= i) { st = 'levé'; vu = true; }
  }
  return vu ? st : '—';
}

function afficherTemps() {
  $('affichage-temps').textContent = fmtTemps(tempsImage(etat.image));
}

// ---------- Liste des événements ----------
function afficherEvenements() {
  const cont = $('liste-evenements');
  cont.innerHTML = '';
  const evts = [...etat.evenements].sort((a, b) => a.image - b.image);
  $('compte-evenements').textContent = evts.length;
  if (!evts.length) {
    cont.innerHTML = '<div class="liste-vide">Aucun événement.<br>Utilisez les boutons Pose / Lever<br>ou les touches W et B.</div>';
    return;
  }
  for (const e of evts) {
    const r = document.createElement('div');
    r.className = 'rangée-evt';
    const fleche = e.type === 'pose' ? '▼' : '▲';
    const nom = (e.type === 'pose' ? 'Pose ' : 'Lever ') + e.pied;
    r.innerHTML = `<span class="fleche couleur-${e.pied}">${fleche}</span>
      <span class="nom couleur-${e.pied}">${nom}</span>
      <span class="num">img ${e.image}</span>
      <span class="num">${fmt2(tempsImage(e.image))} s</span>
      <button class="suppr" title="Supprimer">×</button>`;
    r.addEventListener('click', () => allerImage(e.image));
    r.querySelector('.suppr').addEventListener('click', ev => {
      ev.stopPropagation();
      supprimerEvenement(e);
    });
    cont.appendChild(r);
  }
}

// ---------- Pistes G / D (frises du bas) ----------
function dessinerPistes() {
  for (const [id, pied] of [['piste-g', 'G'], ['piste-d', 'D']]) {
    const canvas = $(id);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w) continue;
    if (canvas.width !== w * devicePixelRatio) {
      canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    }
    const c = canvas.getContext('2d');
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#10141d';
    c.beginPath(); c.roundRect(0, 0, w, h, 6); c.fill();

    const nb = nbImages();
    if (!nb) continue;
    const x = img => 6 + (img / (nb - 1)) * (w - 12);

    // phases d'appui = entre pose et lever
    const evts = etat.evenements.filter(e => e.pied === pied).sort((a, b) => a.image - b.image);
    let debut = null;
    for (const e of evts) {
      if (e.type === 'pose') debut = e.image;
      if (e.type === 'lever' && debut !== null) {
        c.fillStyle = pied === 'G' ? 'rgba(63, 169, 245, .55)' : 'rgba(245, 154, 60, .55)';
        c.beginPath();
        c.roundRect(x(debut), 4, Math.max(2, x(e.image) - x(debut)), h - 8, 4);
        c.fill();
        debut = null;
      }
    }
    // tête de lecture
    c.fillStyle = '#ffffff';
    c.fillRect(Math.min(w - 2, Math.max(0, x(etat.image) - 1)), 0, 2, h);
  }
}

$('piste-g').addEventListener('click', e => cliquePiste(e, 'piste-g'));
$('piste-d').addEventListener('click', e => cliquePiste(e, 'piste-d'));
function cliquePiste(e, id) {
  if (!etat.essaiJson) return;
  const rect = $(id).getBoundingClientRect();
  const frac = (e.clientX - rect.left - 6) / (rect.width - 12);
  allerImage(Math.round(frac * (nbImages() - 1)));
}

// ---------- Paramètres de l'essai ----------
function calculerParametres() {
  const duree = nbImages() ? (nbImages() - 1) / frequence() : 0;
  const poses = etat.evenements.filter(e => e.type === 'pose');
  const cadence = duree ? poses.length / (duree / 60) : 0;
  $('param-cadence').textContent = poses.length ? Math.round(cadence) + ' pas/min' : '—';

  for (const [id, pied] of [['param-appui-g', 'G'], ['param-appui-d', 'D']]) {
    const evts = etat.evenements.filter(e => e.pied === pied).sort((a, b) => a.image - b.image);
    let debut = null, total = 0;
    for (const e of evts) {
      if (e.type === 'pose') debut = e.image;
      if (e.type === 'lever' && debut !== null) { total += e.image - debut; debut = null; }
    }
    $(id).textContent = duree && total
      ? Math.round((total / frequence()) / duree * 100) + ' %' : '—';
  }
}

// ---------- Annotation ----------
function marquerModifie() {
  if (!etat.modifie) {
    etat.modifie = true;
    $('btn-enregistrer').classList.add('modifie');
  }
}

function evenementExiste(pied, type, image) {
  return etat.evenements.some(e => e.pied === pied && e.type === type && e.image === image);
}

function ajouterEvenement(pied, type) {
  if (!etat.essaiJson) return;
  const image = etat.image;
  if (evenementExiste(pied, type, image)) return;
  const ev = { id: crypto.randomUUID(), pied, type, image };
  etat.evenements.push(ev);
  etat.annulations.push({ action: 'ajout', ev });
  marquerModifie();
  afficherEvenements();
  dessinerPistes();
  calculerParametres();
}

function supprimerEvenement(ev) {
  etat.evenements = etat.evenements.filter(x => x.id !== ev.id);
  etat.annulations.push({ action: 'suppression', ev });
  marquerModifie();
  afficherEvenements();
  dessinerPistes();
  calculerParametres();
}

function annuler() {
  const d = etat.annulations.pop();
  if (!d) return;
  if (d.action === 'ajout') {
    etat.evenements = etat.evenements.filter(x => x.id !== d.ev.id);
  } else {
    etat.evenements.push(d.ev);
  }
  marquerModifie();
  afficherEvenements();
  dessinerPistes();
  calculerParametres();
}

// ---------- Lecture ----------
function boutonLecture() {
  $('btn-lecture').textContent = etat.lecture ? '❚❚' : '▶';
  ancreTemps = null; // on repart de l'image courante
}

function allerImage(i) {
  if (!etat.essaiJson) return;
  etat.image = Math.min(nbImages() - 1, Math.max(0, i));
  ancreTemps = null;
  viewer.setFrame(etat.image);
  afficherCarteInfo();
  afficherTemps();
  dessinerPistes();
}

// La lecture avance sur l'horloge réelle (pas sur le rythme d'affichage),
// pour rester à la bonne vitesse même si le navigateur ralentit la page.
let ancreTemps = null, ancreImage = 0;

const viewer = createViewer($('canvas-3d'), {
  frame: () => Math.floor(etat.image),
  suivre: () => etat.lecture, // la caméra suit le sujet seulement pendant la lecture
  tick() {
    if (!etat.lecture || !etat.essaiJson) { ancreTemps = null; return; }
    const maintenant = performance.now();
    if (ancreTemps === null) { ancreTemps = maintenant; ancreImage = etat.image; }
    const nouvelle = ancreImage + (maintenant - ancreTemps) / 1000 * frequence() * etat.vitesse;
    if (nouvelle >= nbImages() - 1) {
      etat.image = nbImages() - 1;
      etat.lecture = false;
      boutonLecture();
      ancreTemps = null;
    } else {
      etat.image = nouvelle;
    }
    viewer.setFrame(Math.floor(etat.image));
    afficherCarteInfo();
    afficherTemps();
    if (Math.floor(etat.image) % 5 === 0) dessinerPistes();
  },
});
viewer.setFrame(0);
window.viewer3d = viewer; // accès pour les tests automatiques

// ---------- Enregistrement ----------
$('btn-enregistrer').addEventListener('click', async () => {
  if (!etat.essai) return;
  const essaiId = etat.essai.id;
  const lignes = etat.evenements.map(e => ({
    essai_id: essaiId, pied: e.pied, type: e.type, image: e.image,
  }));
  const suppr = await db.from('evenements').delete().eq('essai_id', essaiId);
  if (suppr.error) { toast('Erreur : ' + suppr.error.message, true); return; }
  if (lignes.length) {
    const ins = await db.from('evenements').insert(lignes);
    if (ins.error) { toast('Erreur : ' + ins.error.message, true); return; }
  }
  const maj = await db.from('essais').update({ statut: 'annoté' }).eq('id', essaiId);
  if (maj.error) { toast('Erreur : ' + maj.error.message, true); return; }
  etat.essai.statut = 'annoté';
  etat.modifie = false;
  $('btn-enregistrer').classList.remove('modifie');
  afficherSidebar();
  toast('Événements enregistrés');
});

// ---------- Export Excel (CSV ouvrable dans Excel) ----------
$('btn-export').addEventListener('click', () => {
  if (!etat.essaiJson) return;
  const lignes = [
    'Sujet;Visite;Essai;Fichier;Pied;Événement;Image;Temps (s)',
    ...[...etat.evenements].sort((a, b) => a.image - b.image).map(e =>
      [etat.sujet.code, etat.visite.numero, etat.essai.numero, etat.essai.fichier,
       e.pied, e.type, e.image, fmt2(tempsImage(e.image))].join(';')
    ),
  ];
  const blob = new Blob(['﻿' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${etat.essai.fichier.replace('.json', '')}_evenements.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Contrôles de lecture ----------
$('btn-lecture').addEventListener('click', () => {
  if (!etat.essaiJson) return;
  if (etat.image >= nbImages() - 1) etat.image = 0;
  etat.lecture = !etat.lecture;
  boutonLecture();
});
$('btn-debut').addEventListener('click', () => allerImage(0));
$('btn-fin').addEventListener('click', () => allerImage(nbImages() - 1));
$('btn-moins1').addEventListener('click', () => allerImage(etat.image - 1));
$('btn-plus1').addEventListener('click', () => allerImage(Math.floor(etat.image) + 1));

for (const b of document.querySelectorAll('.bouton-vitesse')) {
  b.addEventListener('click', () => {
    etat.vitesse = parseFloat(b.dataset.vitesse);
    ancreTemps = null;
    for (const o of document.querySelectorAll('.bouton-vitesse')) o.classList.toggle('actif', o === b);
  });
}

// ---------- Clavier ----------
window.addEventListener('keydown', e => {
  const t = e.target;
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.closest('dialog')) return;
  if (e.code === 'Space') { e.preventDefault(); $('btn-lecture').click(); return; }
  if (e.code === 'ArrowLeft') { e.preventDefault(); allerImage(etat.image - (e.shiftKey ? 10 : 1)); return; }
  if (e.code === 'ArrowRight') { e.preventDefault(); allerImage(Math.floor(etat.image) + (e.shiftKey ? 10 : 1)); return; }
  if (e.code === 'Home') { allerImage(0); return; }
  if (e.code === 'End') { allerImage(nbImages() - 1); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); annuler(); return; }
  // W (touches Z en code physique KeyZ sur AZERTY) : pose + lever du pied gauche
  if (e.code === 'KeyZ' && !e.ctrlKey) { ajouterEvenement('G', 'pose'); ajouterEvenement('G', 'lever'); return; }
  // B : pose + lever du pied droit
  if (e.code === 'KeyB') { ajouterEvenement('D', 'pose'); ajouterEvenement('D', 'lever'); }
});

// ---------- Boutons Pose / Lever ----------
for (const b of document.querySelectorAll('.bouton-evt')) {
  b.addEventListener('click', () => ajouterEvenement(b.dataset.pied, b.dataset.type));
}

// ---------- Dialogues (nouveau sujet / visite / essai) ----------
const boite = $('boite-dialogue');
let dialogueEnCours = null;

function ouvrirDialogue(kind, contexte) {
  dialogueEnCours = { kind, contexte };
  const corps = $('dialogue-corps');
  if (kind === 'sujet') {
    $('dialogue-titre').textContent = 'Nouveau sujet';
    corps.innerHTML = `
      <label>Code du sujet (ex. S04)</label>
      <input id="dlg-code" required pattern="S\\d+" placeholder="S04">`;
  } else if (kind === 'visite') {
    $('dialogue-titre').textContent = `Nouvelle visite — ${contexte.code}`;
    const numero = Math.max(0, ...etat.visites.filter(v => v.sujet_id === contexte.id).map(v => v.numero)) + 1;
    corps.innerHTML = `
      <label>Numéro (prérempli)</label><input id="dlg-numero" type="number" value="${numero}" min="1">
      <label>Date de la visite</label><input id="dlg-date" type="date">`;
  } else {
    const visite = contexte;
    const sujet = etat.sujets.find(s => s.id === visite.sujet_id);
    $('dialogue-titre').textContent = `Nouvel essai — ${sujet.code} · Visite ${visite.numero}`;
    const numero = Math.max(0, ...etat.essais.filter(e => e.visite_id === visite.id).map(e => e.numero)) + 1;
    corps.innerHTML = `
      <label>Numéro (prérempli)</label><input id="dlg-numero" type="number" value="${numero}" min="1">
      <label>Fichier d'essai (dossier essais)</label><select id="dlg-fichier"></select>`;
    fetch('essais/manifest.json').then(r => r.json()).then(liste => {
      const sel = $('dlg-fichier');
      for (const f of liste) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f + (etat.essais.some(e => e.fichier === f) ? ' (déjà utilisé)' : '');
        sel.appendChild(opt);
      }
    });
  }
  boite.showModal();
  const premier = corps.querySelector('input, select');
  if (premier) premier.focus();
}

$('btn-nouveau-sujet').addEventListener('click', () => ouvrirDialogue('sujet', null));
$('btn-dialogue-annuler').addEventListener('click', () => boite.close());
$('formulaire-dialogue').addEventListener('submit', async () => {
  if (!dialogueEnCours) return;
  const { kind, contexte } = dialogueEnCours;
  try {
    if (kind === 'sujet') {
      const code = $('dlg-code').value.trim().toUpperCase();
      if (!/^S\d+$/.test(code)) { toast('Code attendu : S + numéro (ex. S04)', true); return; }
      const { error } = await db.from('sujets').insert({ code });
      if (error) throw error;
      toast('Sujet ' + code + ' créé');
    } else if (kind === 'visite') {
      const numero = parseInt($('dlg-numero').value, 10);
      const date = $('dlg-date').value || null;
      const { error } = await db.from('visites').insert({ sujet_id: contexte.id, numero, date_visite: date });
      if (error) throw error;
      toast('Visite ' + numero + ' créée');
    } else {
      const numero = parseInt($('dlg-numero').value, 10);
      const fichier = $('dlg-fichier').value;
      if (!fichier) throw new Error('choisissez un fichier');
      const { error } = await db.from('essais').insert({ visite_id: contexte.id, numero, fichier });
      if (error) throw error;
      toast('Essai ' + numero + ' créé');
    }
    await chargerDonnees();
    afficherSidebar();
  } catch (err) {
    toast('Erreur : ' + (err.message || err), true);
    return;
  }
  boite.close();
  dialogueEnCours = null;
});

// ---------- Redessiner les pistes quand la fenêtre change ----------
window.addEventListener('resize', dessinerPistes);

// ---------- Démarrage ----------
chargerDonnees().then(afficherSidebar).catch(err => toast('Erreur de connexion à la base : ' + err.message, true));