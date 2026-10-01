// Genere le SQL d'import : sujets, visites, essais + evenements initiaux
// deduits de contact_sol (0->1 = pose, 1->0 = lever) pour le pied gauche.
const fs = require('fs');
const path = require('path');
const doss = 'c:/Users/2013503170/Downloads/CultureNum-L3SPS (1)/CultureNum-L3SPS/Projets/step3d/essais';

// fichier -> [sujet, visite, essai, date_visite]
const meta = {
  'S01_V1_E1.json': ['S01', 1, 1, '2026-06-02'],
  'S01_V1_E2.json': ['S01', 1, 2, '2026-06-02'],
  'S01_V2_E1.json': ['S01', 2, 1, '2026-06-16'],
  'S02_V1_E1.json': ['S02', 1, 1, null],
  'S02_V1_E2.json': ['S02', 1, 2, null],
  'S03_V1_E1.json': ['S03', 1, 1, null],
};

const sujets = [...new Set(Object.values(meta).map(m => m[0]))];
let sql = '';
for (const s of sujets) sql += `insert into sujets (code) values ('${s}');\n`;

for (const [fichier, [sujet, visite, essai, date]] of Object.entries(meta)) {
  const dateSql = date ? `'${date}'` : 'null';
  sql += `insert into visites (sujet_id, numero, date_visite)\nselect id, ${visite}, ${dateSql} from sujets where code = '${sujet}';\n`;
  sql += `insert into essais (visite_id, numero, fichier, statut)\nselect v.id, ${essai}, '${fichier}', 'à faire'\nfrom visites v join sujets s on s.id = v.sujet_id\nwhere s.code = '${sujet}' and v.numero = ${visite};\n`;

  const j = JSON.parse(fs.readFileSync(path.join(doss, fichier), 'utf8'));
  const arr = j.contact_sol && j.contact_sol.gauche ? j.contact_sol.gauche : [];
  const rows = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === 1 && arr[i - 1] === 0) rows.push(`('G','pose',${i})`);
    if (arr[i] === 0 && arr[i - 1] === 1) rows.push(`('G','lever',${i})`);
  }
  if (rows.length) {
    sql += `insert into evenements (essai_id, pied, type, image)\nselect e.id, v.pied, v.type, v.image\nfrom essais e join (values ${rows.join(',')}) as v(pied,type,image) on true\nwhere e.fichier = '${fichier}';\n`;
  }
}
fs.writeFileSync(__dirname + '/import.sql', sql);
console.log('OK, evenements G genere : ' + (sql.match(/\('G','/g) || []).length + ' lignes');