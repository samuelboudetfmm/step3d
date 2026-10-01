insert into sujets (code) values ('S01');
insert into sujets (code) values ('S02');
insert into sujets (code) values ('S03');
insert into visites (sujet_id, numero, date_visite)
select id, 1, '2026-06-02' from sujets where code = 'S01';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 1, 'S01_V1_E1.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S01' and v.numero = 1;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',960),('G','lever',1003),('G','pose',1079),('G','lever',1120),('G','pose',1190),('G','lever',1230),('G','pose',1302),('G','lever',1349)) as v(pied,type,image) on true
where e.fichier = 'S01_V1_E1.json';
insert into visites (sujet_id, numero, date_visite)
select id, 1, '2026-06-02' from sujets where code = 'S01';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 2, 'S01_V1_E2.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S01' and v.numero = 1;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',721),('G','lever',760),('G','pose',839),('G','lever',882),('G','pose',950),('G','lever',990),('G','pose',1060),('G','lever',1099)) as v(pied,type,image) on true
where e.fichier = 'S01_V1_E2.json';
insert into visites (sujet_id, numero, date_visite)
select id, 2, '2026-06-16' from sujets where code = 'S01';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 1, 'S01_V2_E1.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S01' and v.numero = 2;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',889),('G','lever',943),('G','pose',1025),('G','lever',1072),('G','pose',1144),('G','lever',1189),('G','pose',1258),('G','lever',1302)) as v(pied,type,image) on true
where e.fichier = 'S01_V2_E1.json';
insert into visites (sujet_id, numero, date_visite)
select id, 1, null from sujets where code = 'S02';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 1, 'S02_V1_E1.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S02' and v.numero = 1;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',807),('G','lever',847),('G','pose',923),('G','lever',966),('G','pose',1042),('G','lever',1083)) as v(pied,type,image) on true
where e.fichier = 'S02_V1_E1.json';
insert into visites (sujet_id, numero, date_visite)
select id, 1, null from sujets where code = 'S02';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 2, 'S02_V1_E2.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S02' and v.numero = 1;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',1323),('G','lever',1376),('G','pose',1460),('G','lever',1511),('G','pose',1588),('G','lever',1631),('G','pose',1707),('G','lever',1754)) as v(pied,type,image) on true
where e.fichier = 'S02_V1_E2.json';
insert into visites (sujet_id, numero, date_visite)
select id, 1, null from sujets where code = 'S03';
insert into essais (visite_id, numero, fichier, statut)
select v.id, 1, 'S03_V1_E1.json', 'à faire'
from visites v join sujets s on s.id = v.sujet_id
where s.code = 'S03' and v.numero = 1;
insert into evenements (essai_id, pied, type, image)
select e.id, v.pied, v.type, v.image
from essais e join (values ('G','pose',744),('G','lever',795),('G','pose',862),('G','lever',904),('G','pose',967),('G','lever',1012)) as v(pied,type,image) on true
where e.fichier = 'S03_V1_E1.json';
