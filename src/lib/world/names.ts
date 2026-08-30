// Culture-aware procedural naming engine.
// Names are assembled from culture-specific roots and suffixes, each with an
// etymological gloss so every label can show a plausible "meaning".

import { Rng, subSeed } from "./rng";
import type { CultureId, Named, SettlementKind } from "./types";

export const CULTURE_LABEL: Record<CultureId, string> = {
  nordheim: "Nordheimic",
  vaelora: "Vaeloran",
  stravia: "Stravian",
  kaelan: "Kaelish",
  mahlden: "Mahldish",
};

interface Language {
  label: string;
  stems: string[];
  suffixes: [string, string][]; // form, meaning
  prefixes: [string, string][];
  personFirst: string[];
  personLastA: string[];
  personLastB: string[];
  riverEnd: string[];
  adj: string[];
  rulerTitles: [string, string][];
  realmTitles: string[];
}

const LANGUAGES: Record<CultureId, Language> = {
  nordheim: {
    label: "Nordheimic",
    stems: ["Skar", "Hald", "Ravn", "Bjorn", "Ulf", "Sig", "Sten", "Valk", "Draup", "Hrafn", "Grim", "Tor", "Brand", "Fro", "Eir", "Varg", "Jor", "Askel", "Roar", "Svid"],
    suffixes: [
      ["vik", "bay-settlement"], ["heim", "home"], ["gard", "enclosure"], ["fjord", "fjord"],
      ["holm", "islet"], ["by", "farmstead"], ["nes", "headland"], ["dal", "valley"],
      ["strand", "shore"], ["borg", "fortress"], ["havn", "harbor"], ["sey", "sea-isle"],
    ],
    prefixes: [["Nord", "north"], ["Ost", "east"], ["Vest", "west"], ["Ny", "new"], ["Stor", "great"]],
    personFirst: ["Asger", "Brynja", "Eirik", "Freydis", "Gunnar", "Halvar", "Ingrid", "Jorunn", "Kettil", "Liv", "Ragnvald", "Sigrid", "Sten", "Thora", "Ulfhild", "Valdemar", "Yrsa", "Orm"],
    personLastA: ["Ravn", "Ulf", "Skarde", "Brand", "Grim", "Sten", "Varg", "Falk", "Ivar", "Tor"],
    personLastB: ["sen", "sson", "dottir", "gard", "fjell", "vold"],
    riverEnd: ["a", "elva", "aa"],
    adj: ["Grey", "Cold", "Iron", "Wolf", "Raven", "Frost", "High", "Silent"],
    rulerTitles: [["King", "Queen"], ["Jarl", "Jarless"], ["High King", "High Queen"]],
    realmTitles: ["Kingdom of", "Jarldom of", "Realm of"],
  },
  vaelora: {
    label: "Vaeloran",
    stems: ["Val", "Mont", "Cass", "Lora", "Bel", "Fior", "Sera", "Vign", "Castel", "Torra", "Mira", "Sol", "Alta", "Riva", "Ponte", "Campo", "Font", "Sang"],
    suffixes: [
      ["monte", "hill-town"], ["vera", "true"], ["lia", "land"], ["no", "town"], ["cia", "land"],
      ["mar", "sea"], ["sol", "sun"], ["dora", "of gold"], ["vento", "wind"], ["fior", "flower"],
      ["casta", "fortified"], ["luna", "moon"],
    ],
    prefixes: [["San", "holy"], ["Monte", "mount"], ["Porto", "port"], ["Villa", "town"], ["Castel", "castle"], ["Rio", "river"]],
    personFirst: ["Alessia", "Beno", "Carina", "Dario", "Elodia", "Fabro", "Giulio", "Isaura", "Lorenzo", "Marcella", "Nicoro", "Ottavia", "Renzo", "Serena", "Taddeo", "Viola", "Zorzi", "Emilia"],
    personLastA: ["Mont", "Val", "Ros", "Ferr", "Lomb", "Cors", "Bell", "Fior", "Mar", "Sol"],
    personLastB: ["ari", "etti", "ini", "ucci", "aldi", "oro", "ante"],
    riverEnd: ["e", "ia", "ira"],
    adj: ["Golden", "Sunlit", "Fair", "Bright", "Amber", "Broad", "Old"],
    rulerTitles: [["King", "Queen"], ["Doge", "Dogaressa"], ["Prince", "Princess"], ["Duke", "Duchess"]],
    realmTitles: ["Kingdom of", "Republic of", "Principality of", "Grand Duchy of"],
  },
  stravia: {
    label: "Stravian",
    stems: ["Bel", "Zor", "Vlad", "Niz", "Strag", "Volk", "Mir", "Krasn", "Bor", "Svet", "Dub", "Kamen", "Per", "Rod", "Yar", "Ostr", "Tver", "Zlat"],
    suffixes: [
      ["grad", "fortress-city"], ["sk", "settlement"], ["ov", "place of"], ["in", "town"],
      ["mira", "of peace"], ["bor", "of the pines"], ["pol", "field-city"], ["gorod", "enclosed city"],
      ["lakia", "land"], ["skoye", "village"],
    ],
    prefixes: [["Velik", "great"], ["Nov", "new"], ["Bel", "white"], ["Chern", "black"], ["Star", "old"]],
    personFirst: ["Bogdan", "Danica", "Ilya", "Kazimir", "Ludmila", "Miroslav", "Nadia", "Oleg", "Radmila", "Stanislav", "Tamara", "Vaclav", "Zora", "Dobromir", "Vesna", "Yaroslav", "Milan", "Ruslana"],
    personLastA: ["Volk", "Kov", "Strag", "Bel", "Drag", "Mir", "Rost", "Yar", "Sokol", "Dub"],
    personLastB: ["ovich", "ev", "ski", "in", "ov", "enko"],
    riverEnd: ["ka", "va", "na"],
    adj: ["White", "Black", "Stone", "Old", "Red", "Iron", "Deep"],
    rulerTitles: [["Tsar", "Tsarina"], ["Velik Knyaz", "Velika Knyaginya"], ["Boyar-Lord", "Boyar-Lady"]],
    realmTitles: ["Tsardom of", "Grand Principality of", "Boyarate of"],
  },
  kaelan: {
    label: "Kaelish",
    stems: ["Aber", "Car", "Dun", "Loch", "Bryn", "Glen", "Tre", "Kil", "Mor", "Eilean", "Ross", "Inver", "Bal", "Drum", "Ard", "Kern", "Gwynn", "Tara"],
    suffixes: [
      ["wick", "bay"], ["mor", "great"], ["ness", "promontory"], ["loch", "lake"],
      ["bey", "dwelling"], ["ryn", "hill"], ["don", "fort"], ["tara", "crag"],
      ["gowan", "of the smiths"], ["lan", "glade"],
    ],
    prefixes: [["Caer", "fort of"], ["Dun", "stronghold of"], ["Aber", "mouth of"], ["Glen", "valley of"], ["Bally", "steading of"]],
    personFirst: ["Ailsa", "Bran", "Catriona", "Daveth", "Elowen", "Fergus", "Gwen", "Hamish", "Isolde", "Lachlan", "Maeve", "Niall", "Orlaith", "Rhys", "Sorcha", "Tadhg", "Una", "Wynn"],
    personLastA: ["Mac", "O'", "Kil", "Dun", "Fer"],
    personLastB: ["Leod", "Bran", "Cann", "Duff", "Intyre", "Aoidh", "Bride", "Sorley"],
    riverEnd: ["ow", "an", "ek"],
    adj: ["Green", "Misty", "Fair", "Rushing", "Heather", "Silent", "Briar"],
    rulerTitles: [["Ard Rí", "Ard Ríogain"], ["King", "Queen"], ["Mormaer", "Ban Mormaer"]],
    realmTitles: ["Kingdom of", "Kingship of", "Free Marches of"],
  },
  mahlden: {
    label: "Mahldish",
    stems: ["Eisen", "Wald", "Stein", "Falk", "Grun", "Rot", "Hoch", "Krum", "Lind", "Auer", "Bran", "Donau", "Eber", "Fulken", "Ger", "Holl", "Izar", "Kel"],
    suffixes: [
      ["burg", "fortified town"], ["heim", "home"], ["feld", "field"], ["stadt", "town"],
      ["berg", "mountain"], ["hafen", "harbor"], ["bach", "brook"], ["dorf", "village"],
      ["bruck", "bridge-town"], ["wald", "forest-town"], ["au", "meadow"], ["leben", "homestead"],
    ],
    prefixes: [["Neu", "new"], ["Alt", "old"], ["Gross", "great"], ["Ober", "upper"], ["Nieder", "lower"]],
    personFirst: ["Adelheid", "Bertram", "Clothilde", "Dietrich", "Emmerich", "Frieda", "Gerhart", "Heinrike", "Konrad", "Lore", "Matthias", "Odelinde", "Reinhold", "Sabina", "Theobald", "Ursula", "Wenzel", "Hildegard"],
    personLastA: ["Eisen", "Stein", "Wald", "Falk", "Grun", "Roth", "Schmidt", "Kruger", "Adler", "Berg"],
    personLastB: ["man", "inger", "hart", "rich", "stein", "bach", "er"],
    riverEnd: ["ach", "er", "el"],
    adj: ["Iron", "Grey", "High", "Long", "Old", "Broad", "Oak"],
    rulerTitles: [["König", "Königin"], ["Kurfürst", "Kurfürstin"], ["Markgraf", "Markgräfin"], ["Herzog", "Herzogin"]],
    realmTitles: ["Kingdom of", "Electorate of", "March of", "Duchy of"],
  },
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export class NameFactory {
  private rng: Rng;
  private used = new Set<string>();

  constructor(seed: number) {
    this.rng = new Rng(seed >>> 0);
  }

  private lang(c: CultureId): Language {
    return LANGUAGES[c];
  }

  private unique(text: string, c: CultureId, build: () => string): string {
    let out = text;
    let guard = 0;
    while (this.used.has(out.toLowerCase()) && guard < 24) {
      out = build();
      guard++;
    }
    this.used.add(out.toLowerCase());
    void c;
    return out;
  }

  settlementName(c: CultureId, kind: SettlementKind): Named {
    const L = this.lang(c);
    const r = this.rng;
    const make = (): Named => {
      const stem = r.pick(L.stems);
      const coastal = kind === "port" || kind === "fishing";
      const pool = L.suffixes.filter(([form, meaning]) => {
        if (coastal && (meaning.includes("harbor") || meaning.includes("bay") || meaning.includes("shore") || meaning.includes("islet") || meaning.includes("headland") || meaning.includes("sea"))) return true;
        if (coastal) return r.chance(0.3);
        if (!coastal && (meaning.includes("harbor") || meaning.includes("fjord"))) return false;
        return true;
      });
      let [form, meaning] = r.pick(pool.length ? pool : L.suffixes);
      if (kind === "mining" && r.chance(0.35)) {
        const m: [string, string][] = c === "mahlden" ? [["berg", "mountain"], ["bach", "brook"]] : c === "stravia" ? [["gorod", "enclosed city"]] : c === "nordheim" ? [["dal", "valley"]] : c === "kaelan" ? [["ryn", "hill"]] : [["monte", "hill-town"]];
        [form, meaning] = r.pick(m);
      }
      let text = stem + form;
      if (r.chance(0.16)) {
        const [pre, preMean] = r.pick(L.prefixes);
        const joins = c === "nordheim" || c === "stravia" ? "" : " ";
        text = pre + (joins ? " " : "") + (joins ? cap(stem) : stem.toLowerCase()) + form;
        meaning = `${preMean} ${meaning}`;
      } else if (r.chance(0.07)) {
        text = cap(stem) + "-" + form;
      }
      return { text, lang: L.label, meaning: `'${meaning}' in ${L.label}` };
    };
    let n = make();
    n = { ...n, text: this.unique(n.text, c, () => make().text) };
    return n;
  }

  kingdomName(c: CultureId): { name: Named; title: string } {
    const L = this.lang(c);
    const r = this.rng;
    const stem = r.pick(L.stems);
    const title = r.pick(L.realmTitles);
    const base = r.chance(0.5) ? stem + r.pick(["land", "mark", "ia", "realm"]) : stem + r.pick(L.suffixes)[0];
    const text = this.unique(cap(base), c, () => cap(r.pick(L.stems) + r.pick(["land", "ia", "mark"])));
    return { name: { text, lang: L.label, meaning: `Land of the ${text} folk` }, title };
  }

  personName(c: CultureId): string {
    const L = this.lang(c);
    const r = this.rng;
    if (c === "kaelan") {
      return `${r.pick(L.personFirst)} ${r.pick(L.personLastA)}${r.pick(L.personLastB)}`;
    }
    return `${r.pick(L.personFirst)} ${r.pick(L.personLastA)}${r.pick(L.personLastB)}`;
  }

  rulerTitle(c: CultureId, female: boolean): string {
    const L = this.lang(c);
    const [m, f] = this.rng.pick(L.rulerTitles);
    return female ? f : m;
  }

  riverName(c: CultureId): Named {
    const L = this.lang(c);
    const r = this.rng;
    const stem = r.pick(L.stems);
    const end = r.pick(L.riverEnd);
    const text = this.unique(cap(stem.toLowerCase()) + end, c, () => cap(r.pick(L.stems).toLowerCase()) + r.pick(L.riverEnd));
    return { text, lang: L.label, meaning: `'the ${r.pick(L.adj).toLowerCase()} water' in ${L.label}` };
  }

  regionName(c: CultureId, kind: "mountains" | "forest" | "desert" | "swamp"): Named {
    const L = this.lang(c);
    const r = this.rng;
    const adj = r.pick(L.adj);
    const nouns: Record<string, string[]> = {
      mountains: ["Spine", "Teeth", "Wall", "Cradle", "Monts", "Crown"],
      forest: ["wood", "weald", "Thicket", "Deepwood", "Forest"],
      desert: ["Wastes", "Sands", "Flats"],
      swamp: ["Mires", "Fens", "Bogs"],
    };
    const stem = r.pick(L.stems).toLowerCase();
    const styles: (() => string)[] = [
      () => `The ${adj} ${r.pick(nouns[kind])}`,
      () => `${cap(stem)}${kind === "forest" ? "wood" : kind === "mountains" ? "fells" : r.pick(nouns[kind]).toLowerCase()}`,
    ];
    const text = this.unique(r.pick(styles)(), c, () => `The ${r.pick(L.adj)} ${r.pick(nouns[kind])}`);
    return { text, lang: L.label, meaning: `named for its ${adj.toLowerCase()} aspect` };
  }

  gateName(c: CultureId, ordinal: string): Named {
    const L = this.lang(c);
    const r = this.rng;
    const forms = [`${cap(r.pick(L.stems).toLowerCase())} Gate`, `${r.pick(L.adj)} Gate`, `${ordinal} Gate`, "King's Gate", "Harvest Gate", "Sailors' Gate"];
    return { text: r.pick(forms), lang: L.label, meaning: "a gate of the city wall" };
  }

  streetName(c: CultureId): Named {
    const L = this.lang(c);
    const r = this.rng;
    const things = ["King's", "Guild", "Mill", "Smiths'", "Pilgrims'", "River", "Market", "Salt", "Rope", "Fullers'", "Bakers'"];
    const ends = ["Street", "Row", "Lane", "Way", "Gate-Street", "Braid"];
    return { text: `${r.pick(things)} ${r.pick(ends)}`, lang: L.label, meaning: "a city thoroughfare" };
  }

  tavernName(): string {
    const r = this.rng;
    const a = ["Gilded", "Drunken", "Silver", "Laughing", "Crooked", "Hollow", "Wandering", "Brazen", "Sleeping", "Prancing", "Salt-stained", "Copper", "Quiet", "Fat"];
    const b = ["Boar", "Anchor", "Hart", "Lantern", "Gull", "Barrel", "Crown", "Eel", "Pilgrim", "Mermaid", "Anvil", "Wheel", "Stoat", "Belfry", "Wolf", "Grapes"];
    return `The ${r.pick(a)} ${r.pick(b)}`;
  }
}

export function makeNameFactory(seed: number, tag: string): NameFactory {
  return new NameFactory(subSeed(seed, tag));
}
