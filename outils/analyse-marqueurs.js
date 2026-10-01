// Analyse : combien de marqueurs de chaque pied sont valides à chaque image
const fs = require('fs');
const doss = 'c:/Users/2013503170/Downloads/CultureNum-L3SPS (1)/CultureNum-L3SPS/Projets/step3d/essais';
for (const f of fs.readdirSync(doss).filter(x => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(doss + '/' + f, 'utf8'));
  if (!j.marqueurs) { console.log(f + ': PAS de marqueurs !'); continue; }
  const noms = Object.keys(j.marqueurs);
  const L = noms.filter(n => n.startsWith('L_'));
  const R = noms.filter(n => n.startsWith('R_'));
  const val = p => !(p[0] === 0 && p[1] === 0 && p[2] === 0);
  let lmin = 99, rmin = 99, l0 = 0, r0 = 0, l1rePlage = '', r1rePlage = '';
  for (let i = 0; i < j.nb_images; i++) {
    let nl = 0, nr = 0;
    for (const n of L) if (val(j.marqueurs[n][i])) nl++;
    for (const n of R) if (val(j.marqueurs[n][i])) nr++;
    if (nl < lmin) lmin = nl; if (nr < rmin) rmin = nr;
    if (nl === 0) l0++; if (nr === 0) r0++;
  }
  // valeurs à l'image 0
  const v0 = n => val(j.marqueurs[n][0]) ? 'ok' : '0,0,0';
  console.log(`${f}: L=${L.length} R=${R.length} | min valides L=${lmin} R=${rmin} | images sans L=${l0} sans R=${r0} | img0: L_IAS=${v0('L_IAS')} R_IAS=${v0('R_IAS')}`);
}