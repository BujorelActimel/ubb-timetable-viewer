const COL = { DAY: 0, TIME: 1, FREQ: 2, ROOM: 3, FORMATIA: 4, TYPE: 5, SUBJECT: 6, PROF: 7 };
const DAY_ORDER = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

let config = {};
let allFetchedRows = [];

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(null, async (data) => {
    config = data || {};

    if (!config.baseUrl || !config.selectedPages?.length || !config.selectedSubjects?.length) {
      document.getElementById("content").innerHTML =
        '<div class="empty-state">No timetable configured. Open the extension popup to set up your timetable.</div>';
      return;
    }

    setActiveWeekButton(config.selectedWeek || "all");
    await fetchAllPages();
    render();
  });

  document.getElementById("weekAll").addEventListener("click", () => setWeek("all"));
  document.getElementById("week1").addEventListener("click", () => setWeek("1"));
  document.getElementById("week2").addEventListener("click", () => setWeek("2"));
});

function setWeek(val) {
  config.selectedWeek = val;
  chrome.storage.local.set({ selectedWeek: val });
  setActiveWeekButton(val);
  render();
}

function setActiveWeekButton(val) {
  document.getElementById("weekAll").className = val === "all" ? "active" : "";
  document.getElementById("week1").className = val === "1" ? "active" : "";
  document.getElementById("week2").className = val === "2" ? "active" : "";
}

async function fetchAllPages() {
  const baseUrl = config.baseUrl.replace(/\/?$/, "/");
  allFetchedRows = [];

  const fetches = config.selectedPages.map(async (code) => {
    try {
      const resp = await fetch(baseUrl + code + ".html");
      if (!resp.ok) return;
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      doc.querySelectorAll("table tr").forEach((row) => {
        if (row.querySelector("th")) return;
        const cells = row.querySelectorAll("td");
        if (cells.length < 8) return;

        // Preserve inner HTML for cells that contain links (room, subject, professor)
        allFetchedRows.push({
          pageCode: code,
          day: cells[COL.DAY].textContent.trim(),
          time: cells[COL.TIME].textContent.trim(),
          freq: cells[COL.FREQ].innerHTML.trim(),
          room: cells[COL.ROOM].innerHTML.trim(),
          formatia: cells[COL.FORMATIA].textContent.trim(),
          type: cells[COL.TYPE].textContent.trim(),
          subject: cells[COL.SUBJECT].textContent.trim(),
          subjectHtml: cells[COL.SUBJECT].innerHTML.trim(),
          professor: cells[COL.PROF].textContent.trim(),
          professorHtml: cells[COL.PROF].innerHTML.trim(),
        });
      });
    } catch (e) {
      console.error(`Failed to fetch ${code}:`, e);
    }
  });

  await Promise.all(fetches);
}

function render() {
  const content = document.getElementById("content");
  const selectedWeek = config.selectedWeek || "all";
  const selectedSubjects = config.selectedSubjects || [];
  const slotOverrides = config.slotOverrides || {};
  const defaultGroup = config.defaultGroup || "";
  const defaultSemigroup = config.defaultSemigroup || "";

  const myRows = allFetchedRows.filter((row) => {
    if (!selectedSubjects.includes(row.subject)) return false;

    const overrideKey = `${row.subject}|${row.type}`;
    const wantedFormatia = slotOverrides[overrideKey];

    if (wantedFormatia) {
      if (wantedFormatia === "__none__") return false;
      if (row.formatia !== wantedFormatia) return false;
    } else {
      const wholeYearCode = row.pageCode;
      const isWholeYear = row.formatia === wholeYearCode;
      const isGroup = row.formatia === defaultGroup;
      const isSemigroup = defaultSemigroup && row.formatia === `${defaultGroup}/${defaultSemigroup}`;
      if (!isWholeYear && !isGroup && !isSemigroup) return false;
    }

    if (selectedWeek !== "all") {
      const otherWeek = selectedWeek === "1" ? "sapt. 2" : "sapt. 1";
      if (row.freq.toLowerCase().includes(otherWeek)) return false;
    }

    return true;
  });

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const row of myRows) {
    const key = `${row.day}|${row.time}|${row.freq}|${row.room}|${row.formatia}|${row.type}|${row.subject}|${row.professor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  if (deduped.length === 0) {
    content.innerHTML = '<div class="empty-state">No matching classes found. Check your settings in the popup.</div>';
    return;
  }

  // Sort by day, then time
  deduped.sort((a, b) => {
    const da = DAY_ORDER.indexOf(a.day), db = DAY_ORDER.indexOf(b.day);
    if (da !== db) return da - db;
    return parseStartHour(a.time) - parseStartHour(b.time);
  });

  // Build table in the exact UBB format
  let html = `<table border=1 cellspacing=0 cellpadding=0>
<tr align=center>
<th>Ziua</th>
<th>Orele</th>
<th>Frecventa</th>
<th>Sala</th>
<th>Formatia</th>
<th>Tipul</th>
<th>Disciplina</th>
<th>Cadrul didactic</th>
</tr>`;

  for (const r of deduped) {
    html += `<tr align=center>
<td>${esc(r.day)}</td>
<td class="bloc">${esc(r.time)}</td>
<td>${r.freq || "&nbsp;"}</td>
<td>${r.room}</td>
<td>${esc(r.formatia)}</td>
<td>${esc(r.type)}</td>
<td>${r.subjectHtml}</td>
<td>${r.professorHtml}</td>
</tr>`;
  }

  html += `</table>`;
  content.innerHTML = html;

  // Fix relative links to point to the UBB server
  const baseUrl = config.baseUrl.replace(/\/?$/, "/");
  content.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && href.startsWith("../")) {
      a.href = baseUrl + href;
      a.target = "_blank";
    }
  });
}

function parseStartHour(time) {
  const match = time.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
