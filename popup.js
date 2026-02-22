const DISCIPLINE_COLUMN_INDEX = 6;
const YEARS = ["1", "2", "3"];

let cachedSubjects = {}; // { year: [subjects] }
let activeYears = new Set(); // which year tabs are toggled on

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    ["timetableUrl", "group", "semigroup", "subjects", "selectedWeek"],
    (result) => {
      if (result.timetableUrl) {
        document.getElementById("timetableUrl").value = result.timetableUrl;
      }
      if (result.group) {
        document.getElementById("group").value = result.group;
      }
      if (result.semigroup) {
        document.getElementById("semigroup").value = result.semigroup;
      }

      // Set week toggle
      const week = result.selectedWeek || "all";
      const radio = document.querySelector(
        `input[name="week"][value="${week}"]`
      );
      if (radio) radio.checked = true;

      // Auto-load all years if URL is set
      if (result.timetableUrl) {
        loadAllYears(result.timetableUrl, result.subjects || []);
      }
    }
  );
});

// Year tab clicks — toggle year on/off
document.querySelectorAll(".year-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const year = btn.dataset.year;
    if (activeYears.has(year)) {
      activeYears.delete(year);
      btn.classList.remove("active");
    } else {
      activeYears.add(year);
      btn.classList.add("active");
      // Fetch if not cached
      const baseUrl = document.getElementById("timetableUrl").value.trim();
      if (baseUrl && !cachedSubjects[year]) {
        fetchYear(baseUrl, year).then(() => renderCombinedSubjects());
        return;
      }
    }
    renderCombinedSubjects();
  });
});

// Select all / Deselect all
document.getElementById("selectAll").addEventListener("click", () => {
  document.querySelectorAll('#subjectList input[type="checkbox"]').forEach((cb) => {
    cb.checked = true;
  });
});

document.getElementById("deselectAll").addEventListener("click", () => {
  document.querySelectorAll('#subjectList input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
});

function buildYearUrl(baseUrl, year) {
  return baseUrl.replace(/\/I\d\.html/i, `/I${year}.html`);
}

async function loadAllYears(baseUrl, savedSubjects) {
  const container = document.getElementById("subjectList");
  container.innerHTML = '<div class="subject-loading">Loading subjects...</div>';

  // Set all year buttons to loading
  document.querySelectorAll(".year-tabs button").forEach((btn) => {
    btn.classList.add("loading");
  });

  await Promise.all(YEARS.map((year) => fetchYear(baseUrl, year)));

  // Activate all years by default
  YEARS.forEach((year) => {
    if (cachedSubjects[year] && cachedSubjects[year].length > 0) {
      activeYears.add(year);
    }
  });
  updateYearTabStyles();
  renderCombinedSubjects(savedSubjects);
}

async function fetchYear(baseUrl, year) {
  const btn = document.querySelector(`.year-tabs button[data-year="${year}"]`);
  try {
    const url = buildYearUrl(baseUrl, year);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    cachedSubjects[year] = extractSubjects(doc);
  } catch (err) {
    console.error(`Failed to fetch year ${year}:`, err);
    cachedSubjects[year] = [];
  } finally {
    if (btn) btn.classList.remove("loading");
  }
}

function extractSubjects(doc) {
  const subjects = new Set();
  doc.querySelectorAll("table tr").forEach((row) => {
    if (row.querySelector("th")) return;
    const cells = row.querySelectorAll("td");
    if (cells.length > DISCIPLINE_COLUMN_INDEX) {
      const text = cells[DISCIPLINE_COLUMN_INDEX].textContent.trim();
      if (text) subjects.add(text);
    }
  });
  return [...subjects].sort((a, b) => a.localeCompare(b, "ro"));
}

function updateYearTabStyles() {
  document.querySelectorAll(".year-tabs button").forEach((btn) => {
    btn.classList.toggle("active", activeYears.has(btn.dataset.year));
  });
}

function renderCombinedSubjects(savedSubjects) {
  const container = document.getElementById("subjectList");

  // If savedSubjects not passed, preserve current checkbox state
  if (!savedSubjects) {
    savedSubjects = getSelectedSubjects();
  }

  // Collect subjects grouped by year, only from active years
  const yearEntries = [];
  for (const year of YEARS) {
    if (!activeYears.has(year)) continue;
    const subjects = cachedSubjects[year] || [];
    if (subjects.length > 0) {
      yearEntries.push({ year, subjects });
    }
  }

  if (yearEntries.length === 0) {
    container.innerHTML = '<div class="subject-empty">Select a year to show subjects</div>';
    return;
  }

  const savedLower = savedSubjects.map((s) => s.toLowerCase());

  let html = "";
  for (const { year, subjects } of yearEntries) {
    html += `<div class="year-heading">Anul ${year}</div>`;
    for (const subject of subjects) {
      const checked = savedLower.some(
        (s) => subject.toLowerCase() === s || subject.toLowerCase().includes(s) || s.includes(subject.toLowerCase())
      );
      html += `<label>
        <input type="checkbox" value="${escapeHtml(subject)}" ${checked ? "checked" : ""}>
        ${escapeHtml(subject)}
      </label>`;
    }
  }

  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getSelectedSubjects() {
  const checkboxes = document.querySelectorAll(
    '#subjectList input[type="checkbox"]:checked'
  );
  return [...checkboxes].map((cb) => cb.value);
}

function getSelectedWeek() {
  const radio = document.querySelector('input[name="week"]:checked');
  return radio ? radio.value : "all";
}

// Save button
document.getElementById("saveBtn").addEventListener("click", () => {
  const timetableUrl = document.getElementById("timetableUrl").value.trim();
  const group = document.getElementById("group").value.trim();
  const semigroup = document.getElementById("semigroup").value.trim();
  const subjects = getSelectedSubjects();
  const selectedWeek = getSelectedWeek();

  if (!timetableUrl || !isValidUrl(timetableUrl)) {
    showStatus("Please enter a valid timetable URL", "error");
    return;
  }

  if (!group || isNaN(group) || group <= 0) {
    showStatus("Please enter a valid group number", "error");
    return;
  }

  if (semigroup && (isNaN(semigroup) || semigroup < 1 || semigroup > 2)) {
    showStatus("Semigroup must be 1 or 2", "error");
    return;
  }

  chrome.storage.sync.set(
    { timetableUrl, group, semigroup, subjects, selectedWeek },
    () => {
      showStatus("Settings saved successfully!", "success");
    }
  );
});

// Apply button
document.getElementById("applyBtn").addEventListener("click", () => {
  const timetableUrl = document.getElementById("timetableUrl").value.trim();
  const group = document.getElementById("group").value.trim();
  const semigroup = document.getElementById("semigroup").value.trim();
  const subjects = getSelectedSubjects();
  const selectedWeek = getSelectedWeek();

  if (!timetableUrl || !isValidUrl(timetableUrl)) {
    showStatus("Please enter a valid timetable URL", "error");
    return;
  }

  if (!group || isNaN(group) || group <= 0) {
    showStatus("Please enter a valid group number", "error");
    return;
  }

  if (semigroup && (isNaN(semigroup) || semigroup < 1 || semigroup > 2)) {
    showStatus("Semigroup must be 1 or 2", "error");
    return;
  }

  chrome.storage.sync.set(
    { timetableUrl, group, semigroup, subjects, selectedWeek },
    () => {
      chrome.tabs.create({ url: timetableUrl }, (tab) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.sendMessage(
              tabId,
              { action: "applyFilter" },
              (response) => {
                if (
                  chrome.runtime.lastError ||
                  !response ||
                  !response.success
                ) {
                  showStatus(
                    "Failed to apply filter. Please ensure the page is a valid timetable.",
                    "error"
                  );
                } else {
                  showStatus(
                    "Timetable opened and filter applied successfully!",
                    "success"
                  );
                }
              }
            );
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
    }
  );
});

function isValidUrl(url) {
  try {
    new URL(url);
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
}

function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.className = "status";
  }, 3000);
}
