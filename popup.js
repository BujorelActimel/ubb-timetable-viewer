// Column indices in the timetable HTML tables
const COL = { DAY: 0, TIME: 1, FREQ: 2, ROOM: 3, FORMATIA: 4, TYPE: 5, SUBJECT: 6, PROF: 7 };

const CATALOG = [
  // Licenta
  { section: "Licenta", name: "Matematica - romana", code: "M", years: [1,2,3] },
  { section: "Licenta", name: "Informatica - romana", code: "I", years: [1,2,3] },
  { section: "Licenta", name: "Mat-Info - romana", code: "MI", years: [1,2,3] },
  { section: "Licenta", name: "Mat-Info 4 ani - romana", code: "MIDS", years: [1] },
  { section: "Licenta", name: "Mat-Info - engleza", code: "MIE", years: [1,2,3] },
  { section: "Licenta", name: "Matematica - maghiara", code: "MM", years: [1,2,3] },
  { section: "Licenta", name: "Informatica - maghiara", code: "IM", years: [1,2,3] },
  { section: "Licenta", name: "Mat-Info - maghiara", code: "MIM", years: [2,3] },
  { section: "Licenta", name: "Ing. Informatiei - maghiara", code: "IIM", years: [1,2,3] },
  { section: "Licenta", name: "Mat-Info 4 ani - maghiara", code: "MIMDS", years: [1] },
  { section: "Licenta", name: "Informatica - germana", code: "IG", years: [1,2,3] },
  { section: "Licenta", name: "Informatica - engleza", code: "IE", years: [1,2,3] },
  { section: "Licenta", name: "Inteligenta Artificiala - engleza", code: "IA", years: [1,2,3] },
  { section: "Licenta", name: "Ing. Informatiei - engleza", code: "II", years: [1,2,3] },
  // Master
  { section: "Master", name: "Metode moderne pred. matematicii", code: "MaMetModDid", years: [1,2] },
  { section: "Master", name: "Matematici Avansate - engleza", code: "MaMAv", years: [1,2] },
  { section: "Master", name: "Metode moderne pred. mat. - maghiara", code: "MaMetModDidm", years: [1,2] },
  { section: "Master", name: "Baze de date", code: "MaBD", years: [1,2] },
  { section: "Master", name: "Sisteme distribuite in Internet", code: "MaSD", years: [1,2] },
  { section: "Master", name: "Inginerie software - engleza", code: "MaIS", years: [1,2] },
  { section: "Master", name: "Inteligenta Computationala Aplicata - engleza", code: "MaICA", years: [1,2] },
  { section: "Master", name: "Calcul de inalta performanta - engleza", code: "MaCIP", years: [1,2] },
  { section: "Master", name: "Sisteme informatice avansate - germana/engleza", code: "MaSIA", years: [1,2] },
  { section: "Master", name: "Stiinta datelor in industrie si societate", code: "MaDataSci", years: [1,2] },
  { section: "Master", name: "Securitate cibernetica", code: "Cyber", years: [1,2] },
  { section: "Master", name: "Analiza datelor si modelare - maghiara", code: "ADM", years: [1,2] },
  { section: "Master", name: "Proiectarea si dezvoltarea aplicatiilor Enterprise", code: "PDAE", years: [1,2] },
  { section: "Master", name: "IA pentru industrii conectate - engleza", code: "MaAI4CI", years: [1] },
  { section: "Master", name: "Cloud, retea si HPC - engleza", code: "CNIHPC", years: [1] },
  { section: "Master", name: "Masterat didactic Informatica - romana", code: "StEduID", years: [1,2] },
  { section: "Master", name: "Masterat didactic Matematica - maghiara", code: "StEduMDm", years: [1,2] },
  { section: "Master", name: "Masterat didactic Informatica - maghiara", code: "StEduIDm", years: [1,2] },
];

// All fetched rows: { pageCode, day, time, freq, room, formatia, type, subject, professor }
let allRows = [];
let savedConfig = {};

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  renderCatalog();

  // Collapsible sections
  document.querySelectorAll("[data-toggle]").forEach((hdr) => {
    hdr.addEventListener("click", () => hdr.parentElement.classList.toggle("collapsed"));
  });

  chrome.storage.local.get(null, (data) => {
    savedConfig = data || {};
    if (data.baseUrl) document.getElementById("baseUrl").value = data.baseUrl;
    if (data.defaultGroup) document.getElementById("defaultGroup").value = data.defaultGroup;
    if (data.defaultSemigroup) document.getElementById("defaultSemigroup").value = data.defaultSemigroup;
    if (data.selectedWeek) {
      const r = document.querySelector(`input[name="week"][value="${data.selectedWeek}"]`);
      if (r) r.checked = true;
    }
    // Restore selected pages
    if (data.selectedPages) {
      data.selectedPages.forEach((code) => {
        const cb = document.querySelector(`.catalog-years input[data-code="${code}"]`);
        if (cb) cb.checked = true;
      });
    }
    // Restore cached rows so subjects render instantly
    if (data.cachedRows && data.cachedRows.length > 0) {
      allRows = data.cachedRows;
      renderSubjects();
    }
  });
});

document.getElementById("loadSubjectsBtn").addEventListener("click", loadSubjects);
document.getElementById("saveBtn").addEventListener("click", save);
document.getElementById("applyBtn").addEventListener("click", apply);

// ---- Catalog Rendering ----
function renderCatalog() {
  const container = document.getElementById("catalogList");
  let currentSection = "";
  let html = "";

  for (const entry of CATALOG) {
    if (entry.section !== currentSection) {
      currentSection = entry.section;
      html += `<div style="font-weight:700;font-size:11px;color:#888;padding:6px 0 2px;border-bottom:1px solid #eee;text-transform:uppercase">${currentSection}</div>`;
    }
    const yearCbs = entry.years
      .map((y) => {
        const code = `${entry.code}${y}`;
        return `<label><input type="checkbox" data-code="${code}"> A${y}</label>`;
      })
      .join("");
    html += `<div class="catalog-item"><span class="catalog-name">${entry.name}</span><span class="catalog-years">${yearCbs}</span></div>`;
  }
  container.innerHTML = html;
}

// ---- Fetching & Parsing ----
function getSelectedPageCodes() {
  return [...document.querySelectorAll('.catalog-years input:checked')].map((cb) => cb.dataset.code);
}

async function loadSubjects() {
  const baseUrl = document.getElementById("baseUrl").value.trim();
  if (!baseUrl) { showStatus("Enter a semester base URL first", "error"); return; }

  const codes = getSelectedPageCodes();
  if (codes.length === 0) { showStatus("Select at least one specialization/year", "error"); return; }

  const area = document.getElementById("subjectArea");
  area.innerHTML = '<div class="empty-msg">Loading...</div>';
  allRows = [];

  const fetches = codes.map(async (code) => {
    try {
      const url = baseUrl.replace(/\/?$/, "/") + code + ".html";
      const resp = await fetch(url);
      if (!resp.ok) return;
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      parseRows(doc, code);
    } catch (e) {
      console.error(`Failed to fetch ${code}:`, e);
    }
  });

  await Promise.all(fetches);
  chrome.storage.local.set({ cachedRows: allRows });
  renderSubjects();
}

function parseRows(doc, pageCode) {
  doc.querySelectorAll("table tr").forEach((row) => {
    if (row.querySelector("th")) return;
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return;

    allRows.push({
      pageCode,
      day: cells[COL.DAY].textContent.trim(),
      time: cells[COL.TIME].textContent.trim(),
      freq: cells[COL.FREQ].textContent.trim(),
      room: cells[COL.ROOM].textContent.trim(),
      formatia: cells[COL.FORMATIA].textContent.trim(),
      type: cells[COL.TYPE].textContent.trim(),
      subject: cells[COL.SUBJECT].textContent.trim(),
      professor: cells[COL.PROF].textContent.trim(),
    });
  });
}

// ---- Subject Rendering ----
function renderSubjects() {
  const area = document.getElementById("subjectArea");
  const defaultGroup = document.getElementById("defaultGroup").value.trim();
  const defaultSemigroup = document.getElementById("defaultSemigroup").value.trim();

  // Group by subject
  const subjectMap = new Map(); // subject -> { types: Map<type, row[]>, pageCodes: Set }
  for (const row of allRows) {
    if (!row.subject) continue;
    if (!subjectMap.has(row.subject)) {
      subjectMap.set(row.subject, { types: new Map(), pageCodes: new Set() });
    }
    const entry = subjectMap.get(row.subject);
    entry.pageCodes.add(row.pageCode);
    if (!entry.types.has(row.type)) {
      entry.types.set(row.type, []);
    }
    entry.types.get(row.type).push(row);
  }

  if (subjectMap.size === 0) {
    area.innerHTML = '<div class="empty-msg">No subjects found</div>';
    return;
  }

  const savedSubjects = savedConfig.selectedSubjects || [];
  const savedOverrides = savedConfig.slotOverrides || {};

  const subjects = [...subjectMap.keys()].sort((a, b) => a.localeCompare(b, "ro"));
  let html = "";

  for (const subj of subjects) {
    const { types, pageCodes } = subjectMap.get(subj);
    const isChecked = savedSubjects.includes(subj);
    const sourceLabel = [...pageCodes].join(", ");
    const escapedSubj = escapeAttr(subj);

    html += `<div class="subject-item${isChecked ? " expanded" : ""}" data-subject="${escapedSubj}">`;
    html += `<div class="subject-header">`;
    html += `<input type="checkbox" class="subject-cb" value="${escapedSubj}" ${isChecked ? "checked" : ""}>`;
    html += `<span class="name">${escapeHtml(subj)}</span>`;
    html += `<span class="source">${escapeHtml(sourceLabel)}</span>`;
    html += `</div>`;
    html += `<div class="subject-slots">`;

    // Sort types: Curs first, then Seminar, then Laborator, then others
    const typeOrder = ["Curs", "Seminar", "Laborator"];
    const sortedTypes = [...types.keys()].sort((a, b) => {
      const ia = typeOrder.indexOf(a), ib = typeOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const type of sortedTypes) {
      const rows = types.get(type);
      const overrideKey = `${subj}|${type}`;
      const savedFormatia = savedOverrides[overrideKey];

      html += `<div class="slot-row">`;
      html += `<span class="type-label">${escapeHtml(type)}</span>`;
      html += `<select data-subject="${escapedSubj}" data-type="${escapeAttr(type)}">`;

      // Deduplicate by formatia+day+time
      const seen = new Set();
      const options = [];
      for (const r of rows) {
        const key = `${r.formatia}|${r.day}|${r.time}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push(r);
      }

      // Sort: put default group matches first
      options.sort((a, b) => {
        const aMatch = matchesDefault(a.formatia, defaultGroup, defaultSemigroup);
        const bMatch = matchesDefault(b.formatia, defaultGroup, defaultSemigroup);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return a.formatia.localeCompare(b.formatia);
      });

      for (const opt of options) {
        const val = escapeAttr(opt.formatia);
        const label = `${opt.formatia} — ${opt.day} ${opt.time} — ${opt.professor} — ${opt.room}`;
        const isSelected = savedFormatia
          ? opt.formatia === savedFormatia
          : matchesDefault(opt.formatia, defaultGroup, defaultSemigroup);
        html += `<option value="${val}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`;
      }

      html += `</select></div>`;
    }

    html += `</div></div>`;
  }

  area.innerHTML = html;

  // Toggle expand on subject click
  area.querySelectorAll(".subject-header").forEach((hdr) => {
    hdr.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      const item = hdr.closest(".subject-item");
      item.classList.toggle("expanded");
    });
  });

  // Auto-expand when checking
  area.querySelectorAll(".subject-cb").forEach((cb) => {
    cb.addEventListener("change", () => {
      const item = cb.closest(".subject-item");
      if (cb.checked) item.classList.add("expanded");
    });
  });
}

function matchesDefault(formatia, group, semigroup) {
  if (!group) return false;
  if (formatia === group) return true;
  if (semigroup && formatia === `${group}/${semigroup}`) return true;
  return false;
}

// ---- Save / Apply ----
function gatherConfig() {
  const baseUrl = document.getElementById("baseUrl").value.trim();
  const defaultGroup = document.getElementById("defaultGroup").value.trim();
  const defaultSemigroup = document.getElementById("defaultSemigroup").value.trim();
  const selectedWeek = document.querySelector('input[name="week"]:checked')?.value || "all";
  const selectedPages = getSelectedPageCodes();

  const selectedSubjects = [];
  const slotOverrides = {};

  document.querySelectorAll(".subject-cb:checked").forEach((cb) => {
    const subj = cb.value;
    selectedSubjects.push(subj);

    // Gather slot selections
    const item = cb.closest(".subject-item");
    item.querySelectorAll("select").forEach((sel) => {
      const type = sel.dataset.type;
      const formatia = sel.value;
      if (formatia) {
        slotOverrides[`${subj}|${type}`] = formatia;
      }
    });
  });

  return { baseUrl, defaultGroup, defaultSemigroup, selectedWeek, selectedPages, selectedSubjects, slotOverrides };
}

function save() {
  const config = gatherConfig();
  chrome.storage.local.set(config, () => {
    savedConfig = config;
    showStatus("Settings saved!", "success");
  });
}

function apply() {
  const config = gatherConfig();
  chrome.storage.local.set(config, () => {
    savedConfig = config;
    chrome.tabs.create({ url: chrome.runtime.getURL("timetable.html") });
  });
}

// ---- Helpers ----
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = `status ${type}`;
  setTimeout(() => { el.className = "status"; }, 3000);
}
