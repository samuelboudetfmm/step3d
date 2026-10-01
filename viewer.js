// viewer.js — scène 3D (Three.js) : marqueurs, squelette, traînées, sol, caméra ZQSD
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COULEURS = {
  G: 0x3fa9f5,
  D: 0xf59a3c,
  bassin: 0x9aa7b8,
};

// Groupes de marqueurs d'après les noms du fichier JSON
const estBassin = n => n.endsWith('_IAS') || n.endsWith('_IPS');
const estGauche = n => n.startsWith('L_');
const estDroit = n => n.startsWith('R_');

// Arêtes du squelette, en suffixes de noms
const ARETES_PIED = [
  ['FCC', 'FAL'], ['FAL', 'FM1'], ['FAL', 'FM5'], ['FAL', 'TTC'],
  ['TTC', 'FCC'], ['TTC', 'FAX'], ['FAX', 'FLE'], ['FLE', 'FTC'], ['TTC', 'FTC'],
];
const ARETES_BASSIN = [
  ['L_IAS', 'L_IPS'], ['R_IAS', 'R_IPS'], ['L_IAS', 'R_IAS'], ['L_IPS', 'R_IPS'],
];

export function createViewer(canvas, hooks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b12);
  scene.fog = new THREE.Fog(0x070b12, 14, 45);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);

  scene.add(new THREE.HemisphereLight(0x9db4d0, 0x1a2130, 1.1));
  const lumiere = new THREE.DirectionalLight(0xffffff, 1.4);
  lumiere.position.set(3, 8, 4);
  scene.add(lumiere);

  // ----- Sol : disque sombre + grille discrète -----
  const sol = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x0d1526 })
  );
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);
  const grille = new THREE.GridHelper(60, 60, 0x1a2233, 0x141b29);
  grille.position.y = -0.002;
  scene.add(grille);

  // ----- Contenu de l'essai (recréé au chargement) -----
  const contenu = {
    marqueurs: [],   // {mesh, nom, pos: Float32Array(nb*3), groupe}
    aretes: [],      // {ligne, buffer, paires: [[idxA, idxB], ...]}
    trainees: [],
    centre: new THREE.Vector3(),
  };

  function positionValide(p) {
    return !(Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9 && Math.abs(p[2]) < 1e-9);
  }

  function loadTrial(data) {
    for (const m of contenu.marqueurs) { scene.remove(m.mesh); m.mesh.geometry.dispose(); }
    for (const a of contenu.aretes) { scene.remove(a.ligne); a.ligne.geometry.dispose(); }
    for (const t of contenu.trainees) { scene.remove(t); t.geometry.dispose(); }
    contenu.marqueurs = []; contenu.aretes = []; contenu.trainees = [];

    const nb = data.nb_images;
    const axeV = data.axe_vertical === 'y' ? 1 : 2; // z vertical par défaut

    const geometrieSphere = new THREE.SphereGeometry(0.028, 16, 12);
    const parNom = new Map();

    for (const [nom, points] of Object.entries(data.marqueurs)) {
      const groupe = estBassin(nom) ? 'bassin' : estGauche(nom) ? 'G' : estDroit(nom) ? 'D' : null;
      if (!groupe) continue;
      const pos = new Float32Array(nb * 3);
      for (let i = 0; i < nb; i++) {
        const p = points[i];
        if (positionValide(p)) {
          pos[i * 3] = p[0]; pos[i * 3 + 1] = p[axeV]; pos[i * 3 + 2] = p[1];
        } else {
          pos[i * 3 + 2] = NaN; // marqueur non capté (0,0,0) : invisible
        }
      }
      const mesh = new THREE.Mesh(geometrieSphere, new THREE.MeshStandardMaterial({
        color: COULEURS[groupe], emissive: COULEURS[groupe], emissiveIntensity: 0.35,
        roughness: 0.4, metalness: 0.1,
      }));
      mesh.visible = false;
      scene.add(mesh);
      const m = { mesh, nom, pos, groupe };
      contenu.marqueurs.push(m);
      parNom.set(nom, m);
    }

    // Arêtes du squelette : bassin + chaque pied, en indices de marqueurs
    const groupesAretes = [
      { noms: ARETES_BASSIN, couleur: COULEURS.bassin, opacite: 0.55 },
      { noms: ARETES_PIED.map(a => ['L_' + a[0], 'L_' + a[1]]), couleur: COULEURS.G, opacite: 0.7 },
      { noms: ARETES_PIED.map(a => ['R_' + a[0], 'R_' + a[1]]), couleur: COULEURS.D, opacite: 0.7 },
    ];
    for (const { noms, couleur, opacite } of groupesAretes) {
      const paires = [];
      for (const [a, b] of noms) {
        const ma = parNom.get(a), mb = parNom.get(b);
        if (ma && mb) paires.push([contenu.marqueurs.indexOf(ma), contenu.marqueurs.indexOf(mb)]);
      }
      if (!paires.length) continue;
      const buffer = new Float32Array(paires.length * 6);
      const geometrie = new THREE.BufferGeometry();
      geometrie.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
      const ligne = new THREE.LineSegments(geometrie, new THREE.LineBasicMaterial({
        color: couleur, transparent: true, opacity: opacite,
      }));
      ligne.frustumCulled = false;
      scene.add(ligne);
      contenu.aretes.push({ buffer, geometrie, ligne, paires });
    }

    // Traînées : trajectoire du centre de chaque pied et du bassin
    for (const { test, couleur, opacite } of [
      { test: estGauche, couleur: COULEURS.G, opacite: 0.35 },
      { test: estDroit, couleur: COULEURS.D, opacite: 0.35 },
      { test: estBassin, couleur: COULEURS.bassin, opacite: 0.22 },
    ]) {
      const noms = Object.keys(data.marqueurs).filter(test);
      const centres = [];
      for (let i = 0; i < nb; i++) {
        let x = 0, y = 0, z = 0, cpt = 0;
        for (const nom of noms) {
          const p = data.marqueurs[nom][i];
          if (positionValide(p)) { x += p[0]; y += p[axeV]; z += p[1]; cpt++; }
        }
        centres.push(cpt ? [x / cpt, y / cpt, z / cpt] : null);
      }
      const seg = [];
      for (let i = 0; i < nb - 1; i++) {
        if (!centres[i] || !centres[i + 1]) continue;
        seg.push(...centres[i], ...centres[i + 1]);
      }
      const geometrie = new THREE.BufferGeometry();
      geometrie.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
      const ligne = new THREE.LineSegments(geometrie, new THREE.LineBasicMaterial({
        color: couleur, transparent: true, opacity: opacite,
      }));
      ligne.frustumCulled = false;
      scene.add(ligne);
      contenu.trainees.push(ligne);
    }

    // au chargement, la caméra regarde le sujet à l'image 0
    let x = 0, y = 0, z = 0, cpt = 0;
    for (const m of contenu.marqueurs) {
      if (!Number.isNaN(m.pos[2])) { x += m.pos[0]; y += m.pos[1]; z += m.pos[2]; cpt++; }
    }
    if (cpt) {
      cibleReelle.set(x / cpt, Math.max(0.3, y / cpt), z / cpt);
      vue.cible.copy(cibleReelle);
    }
  }

  // ----- Caméra : orbite à la souris, molette = zoom, ZQSD = déplacement -----
  const vue = { theta: -0.7, phi: 1.05, distance: 3.4, cible: new THREE.Vector3(0, 1, 0) };
  const cibleReelle = vue.cible.clone();
  const deplacement = { avant: false, arriere: false, gauche: false, droite: false };
  const touchesDeplacement = { KeyW: 'avant', KeyS: 'arriere', KeyA: 'gauche', KeyD: 'droite' };
  const direction = new THREE.Vector3();
  const cote = new THREE.Vector3();
  const haut = new THREE.Vector3(0, 1, 0); // l'axe vertical de la scène est y

  function majCamera() {
    camera.position.set(
      vue.cible.x + vue.distance * Math.sin(vue.phi) * Math.cos(vue.theta),
      vue.cible.y + vue.distance * Math.cos(vue.phi),
      vue.cible.z + vue.distance * Math.sin(vue.phi) * Math.sin(vue.theta)
    );
    camera.lookAt(vue.cible);
  }

  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    vue.theta -= dx * 0.006;
    vue.phi = Math.min(Math.PI - 0.05, Math.max(0.08, vue.phi - dy * 0.006));
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    vue.distance = Math.min(25, Math.max(0.4, vue.distance * Math.exp(e.deltaY * 0.0012)));
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const d = touchesDeplacement[e.code];
    if (d) deplacement[d] = true;
  });
  window.addEventListener('keyup', e => {
    const d = touchesDeplacement[e.code];
    if (d) deplacement[d] = false;
  });

  // ----- Boucle de rendu -----
  let derniere = performance.now();
  function boucle(maintenant) {
    const dt = Math.min(0.1, (maintenant - derniere) / 1000);
    derniere = maintenant;

    if (hooks.tick) hooks.tick(dt);

    // Déplacement ZQSD dans le plan horizontal de la caméra
    if (deplacement.avant || deplacement.arriere || deplacement.gauche || deplacement.droite) {
      direction.subVectors(vue.cible, camera.position); direction.y = 0;
      if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
      direction.normalize();
      cote.crossVectors(direction, haut).normalize(); // à droite de l'avancée
      const pas = dt * 0.9 * Math.max(vue.distance, 1);
      if (deplacement.avant) vue.cible.addScaledVector(direction, pas);
      if (deplacement.arriere) vue.cible.addScaledVector(direction, -pas);
      if (deplacement.gauche) vue.cible.addScaledVector(cote, -pas);
      if (deplacement.droite) vue.cible.addScaledVector(cote, pas);
    }

    // Suivi du sujet pendant la lecture uniquement : en pause, ZQSD déplace librement
    if (contenu.marqueurs.length && hooks.frame && (!hooks.suivre || hooks.suivre())) {
      const i = hooks.frame();
      let x = 0, y = 0, z = 0, cpt = 0;
      for (const m of contenu.marqueurs) {
        if (!Number.isNaN(m.pos[i * 3 + 2])) {
          x += m.pos[i * 3]; y += m.pos[i * 3 + 1]; z += m.pos[i * 3 + 2]; cpt++;
        }
      }
      if (cpt) {
        cibleReelle.set(x / cpt, y / cpt, z / cpt);
        const k = Math.min(1, dt * 4);
        vue.cible.x += (cibleReelle.x - vue.cible.x) * k;
        vue.cible.z += (cibleReelle.z - vue.cible.z) * k;
        vue.cible.y += (Math.max(0.3, cibleReelle.y) - vue.cible.y) * k;
      }
    }

    majCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(boucle);
  }

  function redimensionner() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionner).observe(canvas);
  redimensionner();

  // Affiche l'image i : positions des marqueurs et arêtes
  function setFrame(i) {
    for (const m of contenu.marqueurs) {
      const z = m.pos[i * 3 + 2];
      if (Number.isNaN(z)) { m.mesh.visible = false; continue; }
      m.mesh.visible = true;
      m.mesh.position.set(m.pos[i * 3], m.pos[i * 3 + 1], z);
    }
    const nbVisibles = [];
    for (const a of contenu.aretes) {
      let k = 0;
      for (const [ia, ib] of a.paires) {
        const ma = contenu.marqueurs[ia], mb = contenu.marqueurs[ib];
        if (Number.isNaN(ma.pos[i * 3 + 2]) || Number.isNaN(mb.pos[i * 3 + 2])) continue;
        a.buffer.set([ma.pos[i * 3], ma.pos[i * 3 + 1], ma.pos[i * 3 + 2],
                      mb.pos[i * 3], mb.pos[i * 3 + 1], mb.pos[i * 3 + 2]], k * 6);
        k++;
      }
      a.ligne.visible = k > 0;
      a.ligne.geometry.setDrawRange(0, k * 2);
      a.ligne.geometry.attributes.position.needsUpdate = true;
      if (k) nbVisibles.push(a);
    }
  }

  requestAnimationFrame(boucle);

  return { loadTrial, setFrame, vue, camera }; // vue/camera exposés pour les tests
}