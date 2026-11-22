export type StaffTheme = "default" | "dark" | "light";
export type StaffLanguage = "english" | "filipino" | "hiligaynon";

export const STAFF_THEMES: readonly StaffTheme[] = ["default", "dark", "light"];
export const STAFF_LANGUAGES: readonly StaffLanguage[] = [
  "english",
  "filipino",
  "hiligaynon",
];

export const THEME_LABELS: Record<StaffTheme, string> = {
  default: "Default",
  dark: "Dark",
  light: "Light",
};

const LEGACY_THEME_MAP: Record<string, StaffTheme> = {
  ocean: "default",
  forest: "default",
  amber: "default",
  cobalt: "dark",
  midnight: "dark",
  slate: "dark",
};

export function normalizeStaffTheme(raw: unknown): StaffTheme {
  if (raw === "default" || raw === "dark" || raw === "light") return raw;
  if (typeof raw === "string" && raw in LEGACY_THEME_MAP) {
    return LEGACY_THEME_MAP[raw];
  }
  return "default";
}

export function normalizeStaffLanguage(raw: unknown): StaffLanguage {
  if (raw === "english" || raw === "filipino" || raw === "hiligaynon") {
    return raw;
  }
  return "english";
}

/* Phrase dictionary ported directly from legacy-flask/static/js/staff_appearance.js */
const PHRASES: readonly [string, string, string][] = [
  // Sidebar / topbar
  ["Admin Panel", "Panel ng Admin", "Panel sang Admin"],
  ["Main", "Pangunahin", "Pangunahon"],
  ["Home", "Tahanan", "Balay"],
  ["Announcement", "Anunsyo", "Pahibalo"],
  ["Management", "Pamamahala", "Pagdumala"],
  ["User Management", "Pamamahala ng User", "Pagdumala sang User"],
  ["Admins", "Mga Admin", "Mga Admin"],
  ["Librarians", "Mga Librarian", "Mga Librarian"],
  ["Users / Members", "Mga User / Miyembro", "Mga User / Miyembro"],
  ["Add Management", "Magdagdag ng Account", "Magdugang sang Account"],
  ["Add Admin", "Magdagdag ng Admin", "Magdugang sang Admin"],
  ["Add Librarian", "Magdagdag ng Librarian", "Magdugang sang Librarian"],
  ["Borrow Management", "Pamamahala ng Paghiram", "Pagdumala sang Pagpanghulam"],
  ["Borrowing Form", "Porma ng Paghiram", "Porma sang Pagpanghulam"],
  ["Borrow History", "Kasaysayan ng Paghiram", "Kasaysayan sang Pagpanghulam"],
  ["Book Management", "Pamamahala ng Libro", "Pagdumala sang Libro"],
  ["Event Calendar", "Kalendaryo ng Kaganapan", "Kalendaryo sang Hitabo"],
  ["Account Requests", "Mga Kahilingan sa Account", "Mga Hangyo sa Account"],
  ["System Settings", "Mga Setting ng Sistema", "Mga Setting sang Sistema"],
  ["Account settings", "Mga setting ng account", "Mga setting sang account"],
  ["Search for...", "Maghanap ng...", "Pangitaa ang..."],
  ["Collapse sidebar", "I-collapse ang sidebar", "I-collapse ang sidebar"],
  ["Expand sidebar", "I-expand ang sidebar", "I-expand ang sidebar"],
  ["Open menu", "Buksan ang menu", "Buksi ang menu"],
  ["Logout", "Mag-logout", "Mag-log out"],
  ["Clear", "Burahin", "Limpyoha"],

  // Settings page: shell
  ["Settings", "Mga Setting", "Mga Setting"],
  ["Back to Home", "Bumalik sa Tahanan", "Balik sa Balay"],
  ["Administrator", "Tagapangasiwa", "Manugdumala"],
  ["General", "Pangkalahatan", "Pangkabilugan"],
  ["Overview", "Pangkalahatang-tanaw", "Pangkabilugan nga Talan-awon"],
  ["Personal Details", "Personal na Detalye", "Personal nga Detalye"],
  ["Password & Security", "Password at Seguridad", "Password kag Seguridad"],
  ["Preferences", "Mga Kagustuhan", "Mga Ginapili"],
  ["Appearance", "Hitsura", "Hitsura"],
  ["Sign Out", "Mag-sign Out", "Mag-log out"],
  ["Save Changes", "I-save ang Pagbabago", "I-save ang Pagbag-o"],
  [
    "Find a setting… (e.g. password, theme)",
    "Maghanap ng setting… (hal. password, tema)",
    "Pangitaa ang setting… (pananglitan password, tema)",
  ],

  // Settings page: overview
  ["Good to see you,", "Ikinagagalak kitang makita,", "Nalipay kami nga makita ka,"],
  [
    "Manage everything about your account from here.",
    "Pamahalaan ang lahat tungkol sa iyong account dito.",
    "Dumalahan ang tanan parte sa imo account diri.",
  ],
  ["Account Summary", "Buod ng Account", "Sumaryo sang Account"],
  ["Edit", "I-edit", "I-edit"],
  ["Username / Email", "Username / Email", "Username / Email"],
  ["Account Status", "Katayuan ng Account", "Kahimtangan sang Account"],
  ["Active & Verified", "Aktibo at Na-verify", "Aktibo kag Na-verify"],
  ["Pending approval", "Naghihintay ng Pag-apruba", "Nagahulat sang Pag-aprobar"],
  ["Deactivated", "Na-deactivate", "Na-deactivate"],
  ["● Active", "● Aktibo", "● Aktibo"],
  ["● Inactive", "● Hindi Aktibo", "● Indi Aktibo"],
  ["Admin Since", "Admin Mula", "Admin Halin Pa"],
  ["Login Activity", "Aktibidad sa Pag-login", "Aktibidad sang Pag-login"],
  ["Last 6 months", "Nakaraang 6 na buwan", "Nagligad nga 6 ka bulan"],

  // Settings page: personal details
  [
    "Update your profile information.",
    "I-update ang impormasyon ng iyong profile.",
    "I-update ang impormasyon sang imo profile.",
  ],
  ["Personal", "Personal na", "Personal nga"],
  ["Details", "Detalye", "Detalye"],
  ["Profile Info", "Impormasyon ng Profile", "Impormasyon sang Profile"],
  ["Contact", "Kontak", "Kontak"],
  ["Basic Info", "Batayang Impormasyon", "Basehan nga Impormasyon"],
  ["First Name", "Unang Pangalan", "Ngalan"],
  ["Last Name", "Apelyido", "Apelyido"],
  ["Gender", "Kasarian", "Sekso"],
  ["Male", "Lalaki", "Lalaki"],
  ["Female", "Babae", "Babayi"],
  ["Others", "Iba pa", "Iban pa"],
  ["Email / Username", "Email / Username", "Email / Username"],
  ["Read-only", "Basahin lamang", "Mabasa lang"],
  ["Phone Number", "Numero ng Telepono", "Numero sang Telepono"],
  ["Save", "I-save", "I-save"],
  ["Cancel", "Ikansela", "Kanselahon"],
  ["First name", "Unang pangalan", "Ngalan"],
  ["Last name", "Apelyido", "Apelyido"],
  ["e.g. 0917 123 4567", "hal. 0917 123 4567", "pananglitan 0917 123 4567"],

  // Settings page: security
  [
    "Keep your account secure.",
    "Panatilihing ligtas ang iyong account.",
    "Pabilinon nga luwas ang imo account.",
  ],
  ["& Security", "at Seguridad", "kag Seguridad"],
  ["Change Password", "Palitan ang Password", "Ilisan ang Password"],
  ["Current Password", "Kasalukuyang Password", "Karon nga Password"],
  ["New Password", "Bagong Password", "Bag-o nga Password"],
  [
    "Confirm New Password",
    "Kumpirmahin ang Bagong Password",
    "Kumpirmahon ang Bag-o nga Password",
  ],
  ["Update Password", "I-update ang Password", "I-update ang Password"],

  // Settings page: appearance
  [
    "Customize how the library looks for you.",
    "I-customize ang hitsura ng aklatan para sa iyo.",
    "I-customize ang hitsura sang librarya para sa imo.",
  ],
  ["Color Theme", "Kulay ng Tema", "Kulay sang Tema"],
  ["Default", "Default", "Default"],
  ["Dark", "Madilim", "Madulom"],
  ["Light", "Maliwanag", "Masanag"],
  ["Selected:", "Napili:", "Napili:"],
  ["Language", "Wika", "Pulong"],
  ["Interface Language", "Wika ng Interface", "Pulong sang Interface"],
  [
    "Changes labeled navigation and UI text",
    "Binabago ang navigation at mga teksto ng UI",
    "Ginabag-o ang navigation kag mga teksto sang UI",
  ],
  ["Changes saved", "Nai-save ang pagbabago", "Naka-save na"],
  [
    "Unsaved changes — click Save Changes to apply.",
    "Hindi pa nai-save — i-click ang I-save ang Pagbabago.",
    "Wala pa na-save — i-click ang I-save ang Pagbag-o.",
  ],
];

const PHRASE_MAP = new Map<string, { filipino: string; hiligaynon: string }>();
for (const [en, fil, hil] of PHRASES) {
  PHRASE_MAP.set(en, { filipino: fil, hiligaynon: hil });
}

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "SVG",
  "CANVAS",
  "IFRAME",
  "INPUT",
  "SELECT",
  "OPTION",
]);

interface NodeState {
  orig: string;
  applied: string | null;
}

const textState = new WeakMap<Text, NodeState>();
const attrState = new WeakMap<Element, Record<string, NodeState>>();
const ATTRS = ["placeholder", "title"] as const;

function isSkippedElement(el: Element | null): boolean {
  for (let p: Element | null = el; p; p = p.parentElement) {
    if (SKIP_TAGS.has(p.tagName) || p.classList.contains("notranslate")) {
      return true;
    }
  }
  return false;
}

function lookupPhrase(trimmed: string, lang: Exclude<StaffLanguage, "english">): string | null {
  const hit = PHRASE_MAP.get(trimmed);
  return hit ? hit[lang] : null;
}

function translateTextNode(node: Text, lang: StaffLanguage): void {
  const el = node.parentElement;
  if (!el || isSkippedElement(el)) return;

  const cur = node.nodeValue ?? "";
  let st = textState.get(node);
  if (!st) {
    st = { orig: cur, applied: null };
    textState.set(node, st);
  } else if (st.applied !== null && cur !== st.applied) {
    st.orig = cur;
    st.applied = null;
  }

  if (lang === "english") {
    if (st.applied !== null) {
      node.nodeValue = st.orig;
      st.applied = null;
    }
    return;
  }

  const trimmed = st.orig.trim();
  if (!trimmed) return;
  const tr = lookupPhrase(trimmed, lang);
  if (tr) {
    const lead = st.orig.match(/^\s*/)?.[0] ?? "";
    const trail = st.orig.match(/\s*$/)?.[0] ?? "";
    const next = `${lead}${tr}${trail}`;
    if (node.nodeValue !== next) node.nodeValue = next;
    st.applied = next;
  } else if (st.applied !== null) {
    node.nodeValue = st.orig;
    st.applied = null;
  }
}

function translateAttrs(el: Element, lang: StaffLanguage): void {
  if (el.closest(".notranslate")) return;
  if (isSkippedElement(el) && el.tagName !== "INPUT") return;

  const states = attrState.get(el) ?? {};
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const cur = el.getAttribute(attr) ?? "";
    let st = states[attr];
    if (!st) {
      st = states[attr] = { orig: cur, applied: null };
    } else if (st.applied !== null && cur !== st.applied) {
      st.orig = cur;
      st.applied = null;
    }

    if (lang === "english") {
      if (st.applied !== null) {
        el.setAttribute(attr, st.orig);
        st.applied = null;
      }
      continue;
    }

    const tr = lookupPhrase(st.orig.trim(), lang);
    if (tr) {
      el.setAttribute(attr, tr);
      st.applied = tr;
    } else if (st.applied !== null) {
      el.setAttribute(attr, st.orig);
      st.applied = null;
    }
  }
  attrState.set(el, states);
}

export function applyStaffDomLanguage(root: Node | null, lang: StaffLanguage): void {
  if (!root || typeof document === "undefined") return;

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    translateTextNode(node as Text, lang);
  }

  const elRoot = root as Element;
  if (elRoot.matches("[placeholder],[title]")) {
    translateAttrs(elRoot, lang);
  }
  const attrEls = elRoot.querySelectorAll("[placeholder],[title]");
  for (let i = 0; i < attrEls.length; i++) {
    translateAttrs(attrEls[i], lang);
  }
}
