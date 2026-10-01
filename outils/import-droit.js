// Génère le SQL d'insertion des événements du pied droit (contact_sol.droit)
const fs = require('fs');
const ids = {
  'S01_V1_E1.json': 'e5c19534-b024-483a-ab48-a34710c44493',
  'S01_V1_E2.json': 'e38952a9-7051-448b-bd37-35cf37e7bc21',
  'S01_V2_E1.json': 'ab0987d2-c67f-4a7a-ad5a-9194128c1581',
  'S02_V1_E1.json': '90303224-c03e-437a-9384-2260c5e34710',
  'S02_V1_E2.json': 'e27740e7-d703-4f6e-b624-a24c5b9edc39',
  'S03_V1_E1.json': '8af05a0b-3077-40b0-9f39-dbda2a6ec487',
};
const doss = __dirname + '/../essais';
const lignes = [];
for (const [f, id] of Object.entries(ids)) {
  const v = JSON.parse(fs.readFileSync(doss + '/' + f, 'utf8')).contact_sol.droit;
  const ev = [];
  if (v[0] === 1) ev.push(['pose', 0]);
  for (let i = 1; i < v.length; i++) {
    if (v[i] === 1 && v[i - 1] === 0) ev.push(['pose', i]);
    if (v[i] === 0 && v[i - 1] === 1) ev.push(['lever', i]);
  }
  for (const [t, img] of ev) lignes.push(`('${id}','D','${t}',${img})`);
  console.log(f + ': ' + ev.length + ' événements D');
}
const sql = 'insert into evenements (essai_id, pied, type, image) values\n' + lignes.join(',\n') + ';';
fs.writeFileSync(__dirname + '/import-droit.sql', sql);
console.log('Total : ' + lignes.length + ' événements écrits dans outils/import-droit.sql');