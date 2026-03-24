# Plan De Tests Manuel Par Role

## Objectif

Verifier qu'aucun utilisateur ne voit ou n'accede a des donnees hors de son perimetre.

## Pre-requis

- API locale demarree.
- Web admin demarre.
- Comptes de test disponibles:
  - `admin`
  - `scolarite`
  - `comptable`
  - `enseignant`
  - `parent`
- Donnees de test existantes:
  - au moins 2 eleves
  - au moins 2 classes
  - au moins 1 inscription
  - au moins 1 facture
  - au moins 1 paiement
  - au moins 1 note
  - au moins 1 bulletin
  - au moins 1 absence
  - au moins 1 notification
  - au moins 1 don mosquee

## Regles De Validation

- Une page interdite ne doit pas apparaitre dans le menu.
- Une URL interdite ne doit pas s'afficher si on force l'onglet ou l'ecran.
- Un appel API interdit doit renvoyer `403`.
- Les cartes du dashboard ne doivent contenir que des donnees du role courant.
- En mobile, aucun bloc critique ne doit deborder horizontalement hors des conteneurs prevus.

## Cas Transverses

### CT-01 Navigation principale

- Se connecter avec chaque role.
- Verifier les modules visibles dans la sidebar.
- Verifier que les modules absents ne reapparaissent pas apres rafraichissement.

Resultat attendu:
- la sidebar correspond strictement au role
- aucun module transverse n'apparait

### CT-02 Changement d'URL ou de vue

- Se connecter avec chaque role.
- Tenter d'ouvrir une vue non autorisee depuis les actions de recherche rapide ou via l'interface.
- Tenter un rafraichissement sur une page sensible deja ouverte.

Resultat attendu:
- retour vers un ecran autorise ou message `Acces refuse`
- aucune donnee sensible chargee

### CT-03 Controle reseau

- Ouvrir l'onglet `Network` du navigateur.
- Pour chaque role, verifier les requetes chargees au demarrage.

Resultat attendu:
- `PARENT` ne charge que le portail parent
- `ENSEIGNANT` ne charge que le portail enseignant
- aucun appel a `students`, `reference`, `enrollments`, `grades`, `analytics`, `school-life`, `mosque` hors perimetre

## ADMIN

### Ecrans autorises

- Tableau de bord
- Utilisateurs & droits
- Eleves
- Referentiel
- Inscriptions
- Comptabilite
- Rapports & conformite
- Mosquee
- Notes & bulletins
- Pilotage
- Absences
- Emploi du temps
- Notifications

### Verifications

1. Ouvrir chaque ecran de la sidebar.
2. Verifier que les KPI du dashboard couvrent tout le perimetre.
3. Verifier que l'onglet IAM permet:
   - creation utilisateur
   - edition utilisateur
   - gestion des droits par profil
4. Verifier les exports audit.

Resultat attendu:
- tout le back-office est visible
- aucun ecran parent ou enseignant dedie ne remplace les vues globales

## SCOLARITE

### Ecrans autorises

- Tableau de bord
- Eleves
- Referentiel
- Inscriptions
- Comptabilite
- Notes & bulletins
- Pilotage
- Absences
- Emploi du temps
- Notifications

### Ecrans interdits

- Utilisateurs & droits
- Rapports & conformite
- Mosquee
- Portail enseignant
- Portail parent

### Verifications

1. Verifier l'absence de `Utilisateurs & droits`, `Rapports & conformite` et `Mosquee`.
2. Ouvrir dashboard et verifier qu'il n'y a pas de carte ou tache IAM ou audit.
3. Verifier que les vues globales eleves, inscriptions, notes et vie scolaire restent disponibles.
4. Verifier dans `Network` qu'aucun appel analytics ou mosque n'est charge.

Resultat attendu:
- acces limite au perimetre scolaire
- aucun acces audit, mosquee, IAM

## COMPTABLE

### Ecrans autorises

- Tableau de bord
- Comptabilite
- Mosquee

### Ecrans interdits

- Utilisateurs & droits
- Eleves
- Referentiel
- Inscriptions
- Notes & bulletins
- Pilotage
- Absences
- Emploi du temps
- Notifications
- Portail enseignant
- Portail parent
- Rapports & conformite

### Verifications

1. Verifier que seuls `Tableau de bord`, `Comptabilite` et `Mosquee` sont visibles.
2. Verifier que le dashboard n'affiche que la finance et la mosquee.
3. Verifier que les taches prioritaires ne mentionnent ni eleves, ni inscriptions, ni bulletins.
4. Verifier dans `Network` l'absence d'appels `students`, `reference`, `enrollments`, `grades`, `school-life`, `analytics`.

Resultat attendu:
- acces strictement comptable
- aucune vue vie scolaire ou academique

## ENSEIGNANT

### Ecrans autorises

- Portail enseignant

### Ecrans interdits

- tout le reste

### Verifications

1. Verifier que la sidebar ne contient que `Portail enseignant`.
2. Verifier que le dashboard generique n'apparait pas.
3. Verifier que les donnees visibles concernent uniquement:
   - ses classes
   - ses eleves
   - ses notes
   - son emploi du temps
   - ses notifications
4. Tenter d'acceder aux pages globales `Eleves`, `Inscriptions`, `Notes & bulletins`, `Absences`, `Emploi du temps`, `Notifications`.
5. Verifier dans `Network` que seules les routes `portal/teacher/*` sont chargees.

Resultat attendu:
- aucun acces au back-office
- aucun appel API transverse hors portail enseignant

## PARENT

### Ecrans autorises

- Portail parent

### Ecrans interdits

- tout le reste

### Verifications

1. Verifier que la sidebar ne contient que `Portail parent`.
2. Verifier que le dashboard generique n'apparait pas.
3. Verifier que seules les informations de ses enfants sont visibles:
   - absences
   - bulletins
   - emploi du temps famille
   - factures famille
   - notifications famille
4. Verifier l'absence de:
   - KPI globaux eleves
   - classes globales
   - inscriptions globales
   - recouvrement global
   - notifications globales ecole
5. Verifier dans `Network` que seules les routes `portal/parent/*` sont chargees.

Resultat attendu:
- aucune fuite de donnees ecole
- aucune vue globale ou technique

## Tests API Directs

Executer ces controles avec un token de chaque role.

### PARENT

- `GET /api/v1/students` -> `403`
- `GET /api/v1/enrollments` -> `403`
- `GET /api/v1/analytics/overview` -> `403`
- `GET /api/v1/timetable-slots` -> `403`
- `GET /api/v1/notifications` -> `403`
- `GET /api/v1/portal/parent/overview` -> `200`

### ENSEIGNANT

- `GET /api/v1/students` -> `403`
- `GET /api/v1/reference/classes` -> `403`
- `GET /api/v1/grades/grades` -> `403`
- `GET /api/v1/school-life/attendance` -> `403`
- `GET /api/v1/portal/teacher/overview` -> `200`

### COMPTABLE

- `GET /api/v1/finance/recovery/dashboard` -> `200`
- `GET /api/v1/mosque/dashboard` -> `200`
- `GET /api/v1/analytics/overview` -> `403`
- `GET /api/v1/school-life/notifications` -> `403`
- `GET /api/v1/students` -> `403`

### SCOLARITE

- `GET /api/v1/students` -> `200`
- `GET /api/v1/reference/classes` -> `200`
- `GET /api/v1/analytics/overview` -> `403`
- `GET /api/v1/mosque/dashboard` -> `403`
- `GET /api/v1/users` -> `403`

### ADMIN

- tous les endpoints metier autorises -> `200`

## Tests Responsive

Faire les controles ci-dessous pour `ADMIN`, `ENSEIGNANT` et `PARENT`.

### Largeurs a verifier

- `320px`
- `375px`
- `390px`
- `768px`
- `1024px`

### Points de controle

1. Header lisible sans chevauchement.
2. Logo visible.
3. Champ de recherche lisible.
4. Boutons d'action cliquables.
5. Tableaux scrollables horizontalement si necessaire.
6. Aucun texte blanc sur fond blanc en mode sombre.
7. Aucun bloc critique coupe sur le cote droit.

Resultat attendu:
- lecture possible sur smartphone sans perte d'information critique

## Definition De Fin

La passe est validee si:

- tous les cas UI passent
- tous les cas API interdits renvoient `403`
- aucun role ne voit un module hors perimetre
- aucun ecran mobile critique n'est illisible
