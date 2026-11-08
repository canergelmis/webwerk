// Bhimas: EN · FR · DE. English is the default (their own channels are English) and stays in the
// markup, so the page reads without script. Their slogans, dish names and the Telugu are never
// translated; only our UI words, plain labels, days and times, and the alt / aria text are.
// The choice is remembered in localStorage and shared by every page and the game.
(function () {
  'use strict';
  var DICT = {
    en: {
      'title.home': 'Bhimas Indian Kitchen & Bar · Bonnevoie',
      'title.food': 'Food · Bhimas Indian Kitchen & Bar',
      'title.gada': 'The Gada · Bhimas Indian Kitchen & Bar',
      'title.visit': 'Visit · Bhimas Indian Kitchen & Bar',
      'title.game': 'Bhimas Gada Challenge · Bhimas Indian Kitchen & Bar',
      'nav.aria': 'Main', 'lang.aria': 'Language',
      'nav.home': 'Home', 'nav.food': 'Food', 'nav.gada': 'The Gada', 'nav.visit': 'Visit',
      'veg': 'Veg & Non-Veg',
      'lunch': 'Lunch Buffet', 'weekend': 'Weekend Specials',
      'days.tuefri': 'Tuesday to Friday', 'days.every': 'Every Tuesday to Friday',
      'time.lunch': '12:00 PM - 02:00PM', 'days.weekend': 'Friday Evening to Sunday Evening',
      's.dine': 'Dine In', 's.take': 'Take Away', 's.party': 'Party Services',
      'disc': 'An unofficial website proposal by Webwerk, built from public information and photos, not affiliated with the venue. Anonymous visit statistics, with no cookies and no personal data.',
      // home
      'posters.aria': 'Pages', 'poster.play': 'Play the game',
      // food
      'alt.biryani': 'Hyderabadi biryani in a clay pot, its dough seal opened',
      'alt.ragi': 'Raagi mudda with chicken curry on a banana leaf at Bhimas',
      'alt.thali': 'A thali at Bhimas: biryani, curries, naan and sweets on a banana leaf',
      'tickets.aria': 'Lunch Buffet and Weekend Specials',
      'lunch.say': 'vegetarian and non-vegetarian dishes, traditional curries, rice, breads, desserts, and much more',
      'wk.script': 'Weekend', 'wk.slab': 'Specials',
      // gada
      'alt.gadas': 'The two golden gadas standing in the dining room at Bhimas',
      // visit
      'alt.neon': 'The white BHIMAS neon sign set in a living plant wall with white flowers, inside Bhimas',
      'hall.aria': 'Inside Bhimas',
      'alt.welcome': 'Their welcome wall: స్వాగతం-సుస్వాగతం and WELCOME in gold over a painted dancer between two elephants',
      'alt.bar': 'The bar at Bhimas: two crystal chandeliers over a wall of bottles, with painted dolls on the top shelf',
      'alt.dining': 'The dining room: dark tables with tile-pattern placemats, green walls hung with South Indian paintings',
      'find.aria': 'Find us',
      // game
      'g.nav': 'Game', 'g.help': 'Replay the demo', 'g.sound': 'Sound', 'g.pause': 'Pause', 'g.order': 'Order card',
      'g.rule': 'Catch what the card asks for. Dodge the chillies.',
      'g.start': 'Start', 'g.retry': 'Try again', 'g.score': 'Score', 'g.best': 'Best', 'g.paused': 'Pause',
      'g.caught': '{d} caught', 'g.slotCaught': '{d}, caught', 'g.dup': 'Already have {d}',
      'g.chilliKnock': 'Chilli! {d} knocked off', 'g.chilli': 'Chilli!', 'g.time': 'Time is up',
      'g.cleared': 'Round cleared', 'g.lift': 'Gada lifted, {n} of 3', 'g.missed': 'Missed',
      'g.wonScore': 'Score {s}', 'g.pausedSay': 'Paused', 'g.resumed': 'Resumed',
      'dish.rice': 'Rice', 'dish.sweets': 'Sweets'
    },
    fr: {
      'title.home': 'Bhimas Indian Kitchen & Bar · Bonnevoie',
      'title.food': 'Cuisine · Bhimas Indian Kitchen & Bar',
      'title.gada': 'The Gada · Bhimas Indian Kitchen & Bar',
      'title.visit': 'Venir · Bhimas Indian Kitchen & Bar',
      'title.game': 'Bhimas Gada Challenge · Bhimas Indian Kitchen & Bar',
      'nav.aria': 'Navigation principale', 'lang.aria': 'Langue',
      'nav.home': 'Accueil', 'nav.food': 'Cuisine', 'nav.gada': 'The Gada', 'nav.visit': 'Venir',
      'veg': 'Végétarien & non végétarien',
      'lunch': 'Buffet du midi', 'weekend': 'Spécialités du week-end',
      'days.tuefri': 'Du mardi au vendredi', 'days.every': 'Du mardi au vendredi',
      'time.lunch': '12 h – 14 h', 'days.weekend': 'Du vendredi soir au dimanche soir',
      's.dine': 'Sur place', 's.take': 'À emporter', 's.party': 'Service traiteur',
      'disc': "Proposition de site non officielle, réalisée par Webwerk à partir d'informations et de photos publiques, sans lien avec l'établissement. Statistiques de fréquentation anonymes, sans cookie ni donnée personnelle.",
      'posters.aria': 'Pages', 'poster.play': 'À vous de jouer',
      'alt.biryani': 'Biryani hyderabadi dans un pot en terre, son couvercle de pâte ouvert',
      'alt.ragi': 'Raagi mudda et curry de poulet sur une feuille de bananier, chez Bhimas',
      'alt.thali': 'Un thali chez Bhimas : biryani, currys, naan et douceurs sur une feuille de bananier',
      'tickets.aria': 'Buffet du midi et spécialités du week-end',
      'lunch.say': 'plats végétariens et non végétariens, currys traditionnels, riz, pains, desserts et bien plus encore',
      'wk.script': 'Le week-end', 'wk.slab': 'Spécialités',
      'alt.gadas': 'Les deux gadas dorées dressées dans la salle de Bhimas',
      'alt.neon': "L'enseigne néon blanche BHIMAS dans un mur végétal fleuri de blanc, à l'intérieur de Bhimas",
      'hall.aria': 'Chez Bhimas',
      'alt.welcome': "Le mur d'accueil : స్వాగతం-సుస్వాగతం et WELCOME en lettres d'or, au-dessus d'une danseuse peinte entre deux éléphants",
      'alt.bar': "Le bar de Bhimas : deux lustres en cristal devant un mur de bouteilles, des poupées peintes sur l'étagère du haut",
      'alt.dining': "La salle : tables sombres et sets de table à motif de carreaux, murs verts ornés de peintures du Sud de l'Inde",
      'find.aria': 'Nous trouver',
      'g.nav': 'Jeu', 'g.help': 'Revoir la démonstration', 'g.sound': 'Son', 'g.pause': 'Pause', 'g.order': 'Carte de commande',
      'g.rule': 'Attrapez ce que demande la carte. Évitez les piments.',
      'g.start': 'Jouer', 'g.retry': 'Réessayer', 'g.score': 'Score', 'g.best': 'Record', 'g.paused': 'Pause',
      'g.caught': 'Attrapé : {d}', 'g.slotCaught': '{d}, attrapé', 'g.dup': 'Déjà sur la feuille : {d}',
      'g.chilliKnock': 'Piment ! Tombé : {d}', 'g.chilli': 'Piment !', 'g.time': 'Temps écoulé',
      'g.cleared': 'Manche réussie', 'g.lift': 'Gada levée, {n} sur 3', 'g.missed': 'Raté',
      'g.wonScore': 'Score {s}', 'g.pausedSay': 'En pause', 'g.resumed': 'Reprise',
      'dish.rice': 'Riz', 'dish.sweets': 'Douceurs'
    },
    de: {
      'title.home': 'Bhimas Indian Kitchen & Bar · Bonnevoie',
      'title.food': 'Küche · Bhimas Indian Kitchen & Bar',
      'title.gada': 'The Gada · Bhimas Indian Kitchen & Bar',
      'title.visit': 'Besuch · Bhimas Indian Kitchen & Bar',
      'title.game': 'Bhimas Gada Challenge · Bhimas Indian Kitchen & Bar',
      'nav.aria': 'Hauptnavigation', 'lang.aria': 'Sprache',
      'nav.home': 'Start', 'nav.food': 'Küche', 'nav.gada': 'The Gada', 'nav.visit': 'Besuch',
      'veg': 'Vegetarisch & nicht vegetarisch',
      'lunch': 'Mittagsbuffet', 'weekend': 'Wochenend-Spezialitäten',
      'days.tuefri': 'Dienstag bis Freitag', 'days.every': 'Dienstag bis Freitag',
      'time.lunch': '12–14 Uhr', 'days.weekend': 'Freitagabend bis Sonntagabend',
      's.dine': 'Vor Ort', 's.take': 'Zum Mitnehmen', 's.party': 'Party-Service',
      'disc': 'Inoffizieller Website-Vorschlag von Webwerk, erstellt aus öffentlichen Informationen und Fotos, ohne Verbindung zum Lokal. Anonyme Besuchsstatistik, ohne Cookies und ohne personenbezogene Daten.',
      'posters.aria': 'Seiten', 'poster.play': 'Jetzt spielen',
      'alt.biryani': 'Hyderabadi Biryani im Tontopf, das Teigsiegel geöffnet',
      'alt.ragi': 'Raagi Mudda mit Hähnchencurry auf einem Bananenblatt bei Bhimas',
      'alt.thali': 'Ein Thali bei Bhimas: Biryani, Currys, Naan und Süßes auf einem Bananenblatt',
      'tickets.aria': 'Mittagsbuffet und Wochenend-Spezialitäten',
      'lunch.say': 'vegetarische und nicht vegetarische Gerichte, traditionelle Currys, Reis, Brot, Desserts und vieles mehr',
      'wk.script': 'Am Wochenende', 'wk.slab': 'Spezialitäten',
      'alt.gadas': 'Die zwei goldenen Gadas im Gastraum von Bhimas',
      'alt.neon': 'Der weiße BHIMAS-Neonschriftzug in einer Pflanzenwand mit weißen Blüten, drinnen bei Bhimas',
      'hall.aria': 'Bei Bhimas',
      'alt.welcome': 'Die Willkommenswand: స్వాగతం-సుస్వాగతం und WELCOME in Gold über einer gemalten Tänzerin zwischen zwei Elefanten',
      'alt.bar': 'Die Bar bei Bhimas: zwei Kristallleuchter vor einer Flaschenwand, bemalte Puppen auf dem obersten Regal',
      'alt.dining': 'Der Gastraum: dunkle Tische mit Platzsets im Fliesenmuster, grüne Wände mit südindischen Gemälden',
      'find.aria': 'So finden Sie uns',
      'g.nav': 'Spiel', 'g.help': 'Demo noch einmal ansehen', 'g.sound': 'Ton', 'g.pause': 'Pause', 'g.order': 'Bestellkarte',
      'g.rule': 'Fang, was die Karte verlangt. Weich den Chilis aus.',
      'g.start': 'Start', 'g.retry': 'Noch einmal', 'g.score': 'Punkte', 'g.best': 'Rekord', 'g.paused': 'Pause',
      'g.caught': 'Gefangen: {d}', 'g.slotCaught': '{d}, gefangen', 'g.dup': 'Schon auf dem Blatt: {d}',
      'g.chilliKnock': 'Chili! Verloren: {d}', 'g.chilli': 'Chili!', 'g.time': 'Die Zeit ist um',
      'g.cleared': 'Runde geschafft', 'g.lift': 'Gada gehoben, {n} von 3', 'g.missed': 'Daneben',
      'g.wonScore': 'Punkte {s}', 'g.pausedSay': 'Pausiert', 'g.resumed': 'Weiter',
      'dish.rice': 'Reis', 'dish.sweets': 'Süßes'
    }
  };
  var KEY = 'bh_lang';
  var lang = 'en';
  try { var saved = localStorage.getItem(KEY); if (DICT[saved]) lang = saved; } catch (e) { /* private mode: stay EN */ }

  function t(k, vars) {
    var s = DICT[lang][k];
    if (s == null) s = DICT.en[k];
    if (s == null) return null;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, v) { return vars[v] != null ? vars[v] : m; });
    return s;
  }
  function each(sel, fn) { var n = document.querySelectorAll(sel); for (var i = 0; i < n.length; i++) fn(n[i]); }
  function apply() {
    document.documentElement.lang = lang;
    each('[data-t]', function (el) { var s = t(el.getAttribute('data-t')); if (s != null) el.textContent = s; });
    each('[data-t-alt]', function (el) { var s = t(el.getAttribute('data-t-alt')); if (s != null) el.alt = s; });
    each('[data-t-aria]', function (el) { var s = t(el.getAttribute('data-t-aria')); if (s != null) el.setAttribute('aria-label', s); });
    each('[data-lang]', function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    document.dispatchEvent(new CustomEvent('bh:lang', { detail: lang }));
  }
  function set(l) {
    if (!DICT[l]) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* not remembered */ }
    apply();
  }
  each('[data-lang]', function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-lang')); }); });
  window.BH = { t: t, set: set, get lang() { return lang; } };
  apply();
})();
