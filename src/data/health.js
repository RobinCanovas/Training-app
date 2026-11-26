// ───────────── Matériel & compléments à acheter avant le 30/11/2026 ─────────────
export const EQUIPMENT = [
  { id: 'kitchen', group: 'Mesure', name: 'Balance de cuisine (précision 1 g)', why: 'Pour peser les portions les 2 premières semaines. Ensuite tu les connais à l’œil.', qty: '1' },
  { id: 'scale', group: 'Mesure', name: 'Pèse-personne (précision 0,1 kg)', why: 'Pesée à jeun, même heure, même balance. Le chiffre seul compte peu, la moyenne de la semaine compte.', qty: '1' },
  { id: 'tape', group: 'Mesure', name: 'Mètre ruban (optionnel)', why: 'Tour de taille et de bras toutes les 4 semaines : vérifie que la prise reste « propre ».', qty: '1' },
  { id: 'shaker', group: 'Cuisine', name: 'Shaker 700 ml–1 L avec boule ou mini-blender', why: 'Pour le Shake Liquid Mass (≈ 800 kcal en 2 min).', qty: '1' },
  { id: 'bottle', group: 'Cuisine', name: 'Gourde graduée 750 ml–1 L', why: 'Hydratation 3 L : 4 gourdes de 750 ml ou 3 de 1 L.', qty: '1' },
  { id: 'boxes', group: 'Cuisine', name: 'Boîtes de conservation (4 à 6)', why: 'Batch cooking du dimanche : riz, poulet, légumes pour 3 jours.', qty: '4–6' },
  { id: 'shoes', group: 'Course', name: 'Chaussures de running adaptées', why: 'Essayées en magasin spécialisé, avec chaussettes de course. Ne cours pas en chaussures de salle.', qty: '1 paire' },
  { id: 'watch', group: 'Course', name: 'Montre ou capteur cardio (optionnel)', why: 'Pour surveiller la zone 2. Le test de la parole suffit si tu n’en as pas.', qty: '1' },
  { id: 'creatine', group: 'Compléments', name: 'Créatine monohydrate Creapure®', why: 'Dose 3–5 g/jour. À 5 g/jour sur 18 semaines : ≈ 630 g (1 pot de 500 g + 1 de 250 g). À 3 g/jour : ≈ 380 g.', qty: '≈ 630 g' },
  { id: 'whey', group: 'Compléments', name: 'Whey (protéine de lactosérum)', why: '25 g par shake : ≈ 3,2 kg sur 18 semaines. Un sac de 2 kg d’abord, le second vers la semaine 11.', qty: '≈ 3,2 kg' },
  { id: 'omega3', group: 'Compléments', name: 'Oméga-3 (EPA + DHA)', why: 'Vise ≈ 1 g d’EPA + DHA par jour (lis le dosage sur l’étiquette, pas celui de l’huile de poisson totale). Environ 250 capsules à 2/jour.', qty: '≈ 250 caps.' },
  { id: 'mg', group: 'Compléments', name: 'Magnésium bisglycinate', why: 'Le soir, dose de l’étiquette. Les compléments ne doivent pas dépasser ≈ 250 mg de magnésium élémentaire par jour (repère EFSA).', qty: 'selon étiquette' },
  { id: 'alarms', group: 'Organisation', name: 'Alarmes téléphone configurées', why: 'Liste prête dans l’onglet Nutrition. Aucune appli ne sonne à ta place en arrière-plan : c’est ton réveil qui le fait.', qty: '11 alarmes' },
  { id: 'gym', group: 'Organisation', name: 'Sac de sport prêt + abonnement salle', why: 'Serviette, gourde, chaussures plates. Prépare le sac la veille.', qty: '1' },
];

// ───────────── Mensurations (mètre ruban, toutes les 4 semaines) ─────────────
export const BODY_MEASURES = [
  { id: 'waist', label: 'Tour de taille', how: 'À hauteur du nombril, après une expiration normale.' },
  { id: 'arm', label: 'Tour de bras', how: 'Au milieu du bras, détendu.' },
  { id: 'chest', label: 'Tour de poitrine', how: 'Sous les aisselles, à hauteur des mamelons.' },
  { id: 'thigh', label: 'Tour de cuisse', how: 'À mi-cuisse, debout, jambe détendue.' },
];
export const BODY_EVERY_DAYS = 28;

// ───────────── Bilan sanguin ─────────────
export const BLOOD_MARKERS = [
  { id: 'tt', group: 'Hormones', name: 'Testostérone totale', unit: 'nmol/L' },
  { id: 'tb', group: 'Hormones', name: 'Testostérone biodisponible', unit: 'nmol/L' },
  { id: 'lh', group: 'Hormones', name: 'LH', unit: 'UI/L' },
  { id: 'fsh', group: 'Hormones', name: 'FSH', unit: 'UI/L' },
  { id: 'e2', group: 'Hormones', name: 'Estradiol (E2)', unit: 'pmol/L' },
  { id: 'shbg', group: 'Hormones', name: 'SHBG', unit: 'nmol/L' },
  { id: 'hct', group: 'Sang', name: 'Hématocrite (NFS)', unit: '%' },
  { id: 'hb', group: 'Sang', name: 'Hémoglobine (NFS)', unit: 'g/dL' },
  { id: 'chol', group: 'Lipides', name: 'Cholestérol total', unit: 'g/L' },
  { id: 'hdl', group: 'Lipides', name: 'HDL', unit: 'g/L' },
  { id: 'ldl', group: 'Lipides', name: 'LDL', unit: 'g/L' },
  { id: 'tg', group: 'Lipides', name: 'Triglycérides', unit: 'g/L' },
  { id: 'asat', group: 'Foie', name: 'ASAT', unit: 'UI/L' },
  { id: 'alat', group: 'Foie', name: 'ALAT', unit: 'UI/L' },
  { id: 'na', group: 'Ionogramme', name: 'Sodium', unit: 'mmol/L' },
  { id: 'k', group: 'Ionogramme', name: 'Potassium', unit: 'mmol/L' },
  { id: 'cl', group: 'Ionogramme', name: 'Chlorures', unit: 'mmol/L' },
  { id: 'creat', group: 'Reins', name: 'Créatinine', unit: 'µmol/L' },
  { id: 'ferr', group: 'Suggestions', name: 'Ferritine', unit: 'µg/L' },
  { id: 'vitd', group: 'Suggestions', name: 'Vitamine D (25-OH)', unit: 'nmol/L' },
  { id: 'glu', group: 'Suggestions', name: 'Glycémie à jeun', unit: 'g/L' },
];

export const BLOOD_NOTES = [
  'Prise de sang le matin, à jeun, de préférence avant 10 h (surtout pour la testostérone). Reste hydraté.',
  'Un bilan hormonal n’est pas toujours prescrit ni remboursé sans motif médical : demande à ton médecin traitant, c’est lui qui prescrit et qui interprète.',
  'La créatine peut faire monter légèrement la créatinine sans atteinte des reins : signale-la au médecin et au laboratoire.',
  'Compare chaque résultat aux valeurs de référence imprimées sur TON compte rendu (elles changent selon le laboratoire et la méthode). L’appli ne juge pas, elle garde l’historique.',
  'Contrôle à la semaine 12, soit entre le 15 et le 21 février 2027, avec les mêmes conditions : même labo, même heure, à jeun.',
];
