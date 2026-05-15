// English verb conjugation — irregular dict + regular rules
// Forms stored as: [3rd-sing-present, present-participle, past, past-participle]

const IRREGULAR = {
  arise:    ["arises",    "arising",    "arose",    "arisen"],
  awake:    ["awakes",    "awaking",    "awoke",    "awoken"],
  be:       ["is",        "being",      "was",      "been"],
  bear:     ["bears",     "bearing",    "bore",     "borne"],
  beat:     ["beats",     "beating",    "beat",     "beaten"],
  become:   ["becomes",   "becoming",   "became",   "become"],
  begin:    ["begins",    "beginning",  "began",    "begun"],
  bend:     ["bends",     "bending",    "bent",     "bent"],
  bind:     ["binds",     "binding",    "bound",    "bound"],
  bite:     ["bites",     "biting",     "bit",      "bitten"],
  bleed:    ["bleeds",    "bleeding",   "bled",     "bled"],
  blow:     ["blows",     "blowing",    "blew",     "blown"],
  break:    ["breaks",    "breaking",   "broke",    "broken"],
  breed:    ["breeds",    "breeding",   "bred",     "bred"],
  bring:    ["brings",    "bringing",   "brought",  "brought"],
  build:    ["builds",    "building",   "built",    "built"],
  burn:     ["burns",     "burning",    "burnt",    "burnt"],
  burst:    ["bursts",    "bursting",   "burst",    "burst"],
  buy:      ["buys",      "buying",     "bought",   "bought"],
  catch:    ["catches",   "catching",   "caught",   "caught"],
  choose:   ["chooses",   "choosing",   "chose",    "chosen"],
  come:     ["comes",     "coming",     "came",     "come"],
  cost:     ["costs",     "costing",    "cost",     "cost"],
  creep:    ["creeps",    "creeping",   "crept",    "crept"],
  cut:      ["cuts",      "cutting",    "cut",      "cut"],
  deal:     ["deals",     "dealing",    "dealt",    "dealt"],
  dig:      ["digs",      "digging",    "dug",      "dug"],
  do:       ["does",      "doing",      "did",      "done"],
  draw:     ["draws",     "drawing",    "drew",     "drawn"],
  dream:    ["dreams",    "dreaming",   "dreamt",   "dreamt"],
  drink:    ["drinks",    "drinking",   "drank",    "drunk"],
  drive:    ["drives",    "driving",    "drove",    "driven"],
  eat:      ["eats",      "eating",     "ate",      "eaten"],
  fall:     ["falls",     "falling",    "fell",     "fallen"],
  feed:     ["feeds",     "feeding",    "fed",      "fed"],
  feel:     ["feels",     "feeling",    "felt",     "felt"],
  fight:    ["fights",    "fighting",   "fought",   "fought"],
  find:     ["finds",     "finding",    "found",    "found"],
  flee:     ["flees",     "fleeing",    "fled",     "fled"],
  fly:      ["flies",     "flying",     "flew",     "flown"],
  forbid:   ["forbids",   "forbidding", "forbade",  "forbidden"],
  forget:   ["forgets",   "forgetting", "forgot",   "forgotten"],
  forgive:  ["forgives",  "forgiving",  "forgave",  "forgiven"],
  freeze:   ["freezes",   "freezing",   "froze",    "frozen"],
  get:      ["gets",      "getting",    "got",      "gotten"],
  give:     ["gives",     "giving",     "gave",     "given"],
  go:       ["goes",      "going",      "went",     "gone"],
  grow:     ["grows",     "growing",    "grew",     "grown"],
  hang:     ["hangs",     "hanging",    "hung",     "hung"],
  have:     ["has",       "having",     "had",      "had"],
  hear:     ["hears",     "hearing",    "heard",    "heard"],
  hide:     ["hides",     "hiding",     "hid",      "hidden"],
  hit:      ["hits",      "hitting",    "hit",      "hit"],
  hold:     ["holds",     "holding",    "held",     "held"],
  hurt:     ["hurts",     "hurting",    "hurt",     "hurt"],
  keep:     ["keeps",     "keeping",    "kept",     "kept"],
  kneel:    ["kneels",    "kneeling",   "knelt",    "knelt"],
  know:     ["knows",     "knowing",    "knew",     "known"],
  lay:      ["lays",      "laying",     "laid",     "laid"],
  lead:     ["leads",     "leading",    "led",      "led"],
  lean:     ["leans",     "leaning",    "leant",    "leant"],
  learn:    ["learns",    "learning",   "learnt",   "learnt"],
  leave:    ["leaves",    "leaving",    "left",     "left"],
  lend:     ["lends",     "lending",    "lent",     "lent"],
  let:      ["lets",      "letting",    "let",      "let"],
  lie:      ["lies",      "lying",      "lay",      "lain"],
  lose:     ["loses",     "losing",     "lost",     "lost"],
  make:     ["makes",     "making",     "made",     "made"],
  mean:     ["means",     "meaning",    "meant",    "meant"],
  meet:     ["meets",     "meeting",    "met",      "met"],
  pay:      ["pays",      "paying",     "paid",     "paid"],
  prove:    ["proves",    "proving",    "proved",   "proven"],
  put:      ["puts",      "putting",    "put",      "put"],
  quit:     ["quits",     "quitting",   "quit",     "quit"],
  read:     ["reads",     "reading",    "read",     "read"],
  ride:     ["rides",     "riding",     "rode",     "ridden"],
  ring:     ["rings",     "ringing",    "rang",     "rung"],
  rise:     ["rises",     "rising",     "rose",     "risen"],
  run:      ["runs",      "running",    "ran",      "run"],
  say:      ["says",      "saying",     "said",     "said"],
  see:      ["sees",      "seeing",     "saw",      "seen"],
  seek:     ["seeks",     "seeking",    "sought",   "sought"],
  sell:     ["sells",     "selling",    "sold",     "sold"],
  send:     ["sends",     "sending",    "sent",     "sent"],
  set:      ["sets",      "setting",    "set",      "set"],
  shake:    ["shakes",    "shaking",    "shook",    "shaken"],
  shed:     ["sheds",     "shedding",   "shed",     "shed"],
  shine:    ["shines",    "shining",    "shone",    "shone"],
  shoot:    ["shoots",    "shooting",   "shot",     "shot"],
  show:     ["shows",     "showing",    "showed",   "shown"],
  shrink:   ["shrinks",   "shrinking",  "shrank",   "shrunk"],
  shut:     ["shuts",     "shutting",   "shut",     "shut"],
  sing:     ["sings",     "singing",    "sang",     "sung"],
  sink:     ["sinks",     "sinking",    "sank",     "sunk"],
  sit:      ["sits",      "sitting",    "sat",      "sat"],
  sleep:    ["sleeps",    "sleeping",   "slept",    "slept"],
  slide:    ["slides",    "sliding",    "slid",     "slid"],
  speak:    ["speaks",    "speaking",   "spoke",    "spoken"],
  spend:    ["spends",    "spending",   "spent",    "spent"],
  spin:     ["spins",     "spinning",   "spun",     "spun"],
  spread:   ["spreads",   "spreading",  "spread",   "spread"],
  spring:   ["springs",   "springing",  "sprang",   "sprung"],
  stand:    ["stands",    "standing",   "stood",    "stood"],
  steal:    ["steals",    "stealing",   "stole",    "stolen"],
  stick:    ["sticks",    "sticking",   "stuck",    "stuck"],
  sting:    ["stings",    "stinging",   "stung",    "stung"],
  stink:    ["stinks",    "stinking",   "stank",    "stunk"],
  strike:   ["strikes",   "striking",   "struck",   "struck"],
  swear:    ["swears",    "swearing",   "swore",    "sworn"],
  sweep:    ["sweeps",    "sweeping",   "swept",    "swept"],
  swim:     ["swims",     "swimming",   "swam",     "swum"],
  swing:    ["swings",    "swinging",   "swung",    "swung"],
  take:     ["takes",     "taking",     "took",     "taken"],
  teach:    ["teaches",   "teaching",   "taught",   "taught"],
  tear:     ["tears",     "tearing",    "tore",     "torn"],
  tell:     ["tells",     "telling",    "told",     "told"],
  think:    ["thinks",    "thinking",   "thought",  "thought"],
  throw:    ["throws",    "throwing",   "threw",    "thrown"],
  understand:["understands","understanding","understood","understood"],
  wake:     ["wakes",     "waking",     "woke",     "woken"],
  wear:     ["wears",     "wearing",    "wore",     "worn"],
  win:      ["wins",      "winning",    "won",      "won"],
  wind:     ["winds",     "winding",    "wound",    "wound"],
  withdraw: ["withdraws", "withdrawing","withdrew", "withdrawn"],
  write:    ["writes",    "writing",    "wrote",    "written"],
};

// Build reverse map: inflected form → base
const REVERSE = {};
for (const [base, forms] of Object.entries(IRREGULAR)) {
  for (const f of forms) {
    if (!REVERSE[f]) REVERSE[f] = base;
  }
}

// Regular verb rules
function reg3rd(base) {
  if (/(?:ch|sh|x|z|o)$/.test(base)) return base + 'es';
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ies';
  return base + 's';
}

function regIng(base) {
  if (/[^aeiou]e$/.test(base)) return base.slice(0, -1) + 'ing';
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) return base + base.slice(-1) + 'ing';
  return base + 'ing';
}

function regPast(base) {
  if (/[^aeiou]e$/.test(base)) return base + 'd';
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ied';
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) return base + base.slice(-1) + 'ed';
  return base + 'ed';
}

// Find base form from any inflected form
function findBase(word) {
  const w = word.toLowerCase().trim();
  if (IRREGULAR[w]) return w;
  if (REVERSE[w])   return REVERSE[w];

  // Strip -ing
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    if (IRREGULAR[stem]) return stem;
    if (IRREGULAR[stem + 'e']) return stem + 'e';
    // doubled consonant: running → run
    if (stem.length >= 2 && stem.slice(-1) === stem.slice(-2, -1)) {
      const un = stem.slice(0, -1);
      if (IRREGULAR[un]) return un;
    }
    if (stem.length >= 3) return stem; // assume regular
  }

  // Strip -ed
  if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    if (IRREGULAR[stem]) return stem;
    if (IRREGULAR[stem + 'e']) return stem + 'e';
    if (stem.length >= 2 && stem.slice(-1) === stem.slice(-2, -1)) {
      const un = stem.slice(0, -1);
      if (IRREGULAR[un]) return un;
    }
    if (stem.length >= 3) return stem;
  }

  // Strip -s / -es / -ies
  if (w.endsWith('ies') && w.length > 4) {
    const stem = w.slice(0, -3) + 'y';
    if (IRREGULAR[stem]) return stem;
    if (stem.length >= 3) return stem;
  }
  if (w.endsWith('es') && w.length > 4) {
    const stem = w.slice(0, -2);
    if (IRREGULAR[stem]) return stem;
  }
  if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) {
    const stem = w.slice(0, -1);
    if (IRREGULAR[stem]) return stem;
  }

  return null;
}

// Return all 5 forms or null if not a verb
function conjugate(word) {
  const base = findBase(word);
  if (!base) return null;

  if (IRREGULAR[base]) {
    const [third, ing, past, pp] = IRREGULAR[base];
    return { base, third, ing, past, pp };
  }

  // Regular
  return {
    base,
    third: reg3rd(base),
    ing:   regIng(base),
    past:  regPast(base),
    pp:    regPast(base),
  };
}
