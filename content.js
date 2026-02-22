function detectWholeYearCode() {
  const match = window.location.pathname.match(/\/(I\d)\.html/i);
  return match ? match[1] : "I3";
}

function detectCurrentYear() {
  const match = window.location.pathname.match(/\/I(\d)\.html/i);
  return match ? match[1] : null;
}

const CONFIG = {
  GROUP_PREFIX: "Grupa",
  WHOLE_YEAR_CODE: detectWholeYearCode(),
  FRECVENTA_COLUMN_INDEX: 2,
  FORMATIA_COLUMN_INDEX: 4,
  DISCIPLINE_COLUMN_INDEX: 6,
  ALL_YEARS: ["1", "2", "3"],
  HIGHLIGHT_COLORS: {
    SEMIGROUP: "#c8e6c9",
    GROUP: "#e8f5e9",
    WHOLE_YEAR: "#f1f8e9",
    OTHER_YEAR: "#fff3e0",
    HEADER: "#4CAF50",
  },
};

let settings = null;

chrome.storage.sync.get(
  ["timetableUrl", "group", "semigroup", "subjects", "selectedWeek"],
  (result) => {
    settings = result;
    if (shouldFilterCurrentPage()) {
      applyFilter();
    }
  }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyFilter") {
    chrome.storage.sync.get(
      ["timetableUrl", "group", "semigroup", "subjects", "selectedWeek"],
      (result) => {
        settings = result;
        if (shouldFilterCurrentPage()) {
          applyFilter();
          sendResponse({ success: true });
        } else {
          sendResponse({
            success: false,
            error: "URL does not match configured timetable URL",
          });
        }
      }
    );
    return true;
  }
});

function shouldFilterCurrentPage() {
  if (!settings || !settings.timetableUrl || !settings.group) {
    return false;
  }
  const currentUrl = window.location.href;
  const configuredUrl = settings.timetableUrl;
  return currentUrl === configuredUrl;
}

async function applyFilter() {
  if (!settings || !settings.group) {
    return;
  }

  const group = settings.group;
  const semigroup = settings.semigroup;
  const subjects = settings.subjects || [];
  const selectedWeek = settings.selectedWeek || "all";

  // Filter current page
  const groupHeaders = document.querySelectorAll("h1");
  groupHeaders.forEach((header) => {
    const headerText = header.textContent;
    if (headerText.includes(CONFIG.GROUP_PREFIX)) {
      if (headerText.includes(`Grupa ${group}`)) {
        header.style.display = "";
        header.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.HEADER;
        header.style.color = "white";
        header.style.padding = "10px";
      } else {
        header.style.display = "none";
      }
    }
  });

  const tables = document.querySelectorAll("table");
  if (!tables.length) {
    console.warn("No tables found on the page.");
    return;
  }

  // Find our group's table so we can inject rows from other years into it
  let ourTable = null;
  let currentGroup = null;

  tables.forEach((table) => {
    let element = table.previousElementSibling;
    while (element) {
      if (
        element.tagName === "H1" &&
        element.textContent.includes(CONFIG.GROUP_PREFIX)
      ) {
        const match = element.textContent.match(/Grupa (\d+)/);
        if (match) {
          currentGroup = match[1];
        }
        break;
      }
      element = element.previousElementSibling;
    }

    if (currentGroup !== group) {
      table.style.display = "none";
      return;
    }

    ourTable = table;
    filterTable(table, group, semigroup, subjects, selectedWeek, CONFIG.WHOLE_YEAR_CODE);
  });

  // Fetch other years and inject matching rows
  if (ourTable && subjects.length > 0) {
    await injectOtherYearRows(ourTable, group, semigroup, subjects, selectedWeek);
  }

  showNotification();
}

function filterTable(table, group, semigroup, subjects, selectedWeek, wholeYearCode) {
  const rows = table.querySelectorAll("tr");
  rows.forEach((row) => {
    if (row.querySelector("th")) return;
    if (row.dataset.injectedYear) return; // skip previously injected rows

    const cells = row.querySelectorAll("td");
    if (cells.length === 0) return;

    let shouldShow = false;
    if (cells.length >= CONFIG.FORMATIA_COLUMN_INDEX + 1) {
      const formatiaText = cells[CONFIG.FORMATIA_COLUMN_INDEX].textContent.trim();
      const disciplineCell =
        cells.length >= CONFIG.DISCIPLINE_COLUMN_INDEX + 1
          ? cells[CONFIG.DISCIPLINE_COLUMN_INDEX]
          : null;

      const isWholeYear = formatiaText === wholeYearCode;
      const isOurGroup = formatiaText === group;
      const isOurSemigroup = semigroup
        ? formatiaText === `${group}/${semigroup}`
        : false;

      if (isWholeYear || isOurGroup || isOurSemigroup) {
        if (selectedWeek !== "all" && cells.length > CONFIG.FRECVENTA_COLUMN_INDEX) {
          const frecventaText = cells[CONFIG.FRECVENTA_COLUMN_INDEX].textContent.trim().toLowerCase();
          const otherWeek = selectedWeek === "1" ? "sapt. 2" : "sapt. 1";
          if (frecventaText.includes(otherWeek)) {
            shouldShow = false;
          } else {
            shouldShow = matchesSubjects(disciplineCell, subjects);
          }
        } else {
          shouldShow = matchesSubjects(disciplineCell, subjects);
        }
      }
    }

    if (shouldShow) {
      row.style.display = "";
      const formatiaText = cells[CONFIG.FORMATIA_COLUMN_INDEX].textContent.trim();
      if (semigroup && formatiaText === `${group}/${semigroup}`) {
        row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.SEMIGROUP;
      } else if (formatiaText === group) {
        row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.GROUP;
      } else {
        row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.WHOLE_YEAR;
      }
    } else {
      row.style.display = "none";
    }
  });
}

async function injectOtherYearRows(ourTable, group, semigroup, subjects, selectedWeek) {
  // Remove previously injected rows
  ourTable.querySelectorAll("tr[data-injected-year]").forEach((r) => r.remove());

  const currentYear = detectCurrentYear();
  const otherYears = CONFIG.ALL_YEARS.filter((y) => y !== currentYear);
  const baseUrl = window.location.href;

  const fetches = otherYears.map(async (year) => {
    try {
      const url = baseUrl.replace(/\/I\d\.html/i, `/I${year}.html`);
      const response = await fetch(url);
      if (!response.ok) return [];
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const wholeYearCode = `I${year}`;

      return extractMatchingRows(doc, group, semigroup, subjects, selectedWeek, wholeYearCode, year);
    } catch (err) {
      console.error(`Failed to fetch year ${year}:`, err);
      return [];
    }
  });

  const results = await Promise.all(fetches);
  const tbody = ourTable.querySelector("tbody") || ourTable;

  for (const rows of results) {
    for (const row of rows) {
      tbody.appendChild(row);
    }
  }
}

function extractMatchingRows(doc, group, semigroup, subjects, selectedWeek, wholeYearCode, year) {
  const matchingRows = [];

  doc.querySelectorAll("table tr").forEach((row) => {
    if (row.querySelector("th")) return;
    const cells = row.querySelectorAll("td");
    if (cells.length < CONFIG.FORMATIA_COLUMN_INDEX + 1) return;

    const formatiaText = cells[CONFIG.FORMATIA_COLUMN_INDEX].textContent.trim();
    const disciplineCell =
      cells.length >= CONFIG.DISCIPLINE_COLUMN_INDEX + 1
        ? cells[CONFIG.DISCIPLINE_COLUMN_INDEX]
        : null;

    const isWholeYear = formatiaText === wholeYearCode;
    const isOurGroup = formatiaText === group;
    const isOurSemigroup = semigroup
      ? formatiaText === `${group}/${semigroup}`
      : false;

    if (!(isWholeYear || isOurGroup || isOurSemigroup)) return;

    // Week filter
    if (selectedWeek !== "all" && cells.length > CONFIG.FRECVENTA_COLUMN_INDEX) {
      const frecventaText = cells[CONFIG.FRECVENTA_COLUMN_INDEX].textContent.trim().toLowerCase();
      const otherWeek = selectedWeek === "1" ? "sapt. 2" : "sapt. 1";
      if (frecventaText.includes(otherWeek)) return;
    }

    if (!matchesSubjects(disciplineCell, subjects)) return;

    // Clone the row and mark it
    const clonedRow = row.cloneNode(true);
    clonedRow.dataset.injectedYear = year;
    clonedRow.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.OTHER_YEAR;
    matchingRows.push(clonedRow);
  });

  return matchingRows;
}

function matchesSubjects(disciplineCell, subjects) {
  if (subjects.length === 0) return true;
  if (!disciplineCell) return false;
  const disciplineText = disciplineCell.textContent.toLowerCase();
  return subjects.some((s) => disciplineText.includes(s.toLowerCase()));
}

function showNotification() {
  if (document.getElementById("ubb-filter-notification")) {
    return;
  }

  const visibleRows =
    document.querySelectorAll('table tr:not([style*="display: none"])').length -
    document.querySelectorAll("table tr th").length;
  const notification = document.createElement("div");
  notification.id = "ubb-filter-notification";
  notification.setAttribute("role", "alert");
  notification.setAttribute("aria-live", "assertive");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${CONFIG.HIGHLIGHT_COLORS.HEADER};
    color: white;
    padding: 15px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `;

  const groupText = settings.semigroup
    ? `Group ${settings.group}/${settings.semigroup}`
    : `Group ${settings.group}`;
  const subjectsText = settings.subjects?.length
    ? `, showing ${settings.subjects.length} subjects`
    : "";
  notification.textContent = `Timetable filtered for ${groupText} (${visibleRows} rows)${subjectsText}`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = "opacity 0.5s";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}
