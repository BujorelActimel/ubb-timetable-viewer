const CONFIG = {
  GROUP_PREFIX: "Grupa",
  WHOLE_YEAR_CODE: "I3",
  FORMATIA_COLUMN_INDEX: 4,
  DISCIPLINE_COLUMN_INDEX: 6,
  HIGHLIGHT_COLORS: {
    SEMIGROUP: "#c8e6c9",
    GROUP: "#e8f5e9",
    WHOLE_YEAR: "#f1f8e9",
    HEADER: "#4CAF50",
  },
};

let settings = null;

chrome.storage.sync.get(
  ["timetableUrl", "group", "semigroup", "subjects"],
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
      ["timetableUrl", "group", "semigroup", "subjects"],
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
    return true; // Keep the message channel open for async response
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

function applyFilter() {
  if (!settings || !settings.group) {
    return;
  }

  const group = settings.group;
  const semigroup = settings.semigroup;
  const subjects = settings.subjects || [];

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

    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const isHeader = row.querySelector("th");
      if (isHeader) {
        return;
      }

      const cells = row.querySelectorAll("td");
      if (cells.length === 0) {
        return;
      }

      let shouldShow = false;
      if (cells.length >= CONFIG.FORMATIA_COLUMN_INDEX + 1) {
        const formatiaCell = cells[CONFIG.FORMATIA_COLUMN_INDEX];
        const formatiaText = formatiaCell.textContent.trim();
        const disciplineCell =
          cells.length >= CONFIG.DISCIPLINE_COLUMN_INDEX + 1
            ? cells[CONFIG.DISCIPLINE_COLUMN_INDEX]
            : null;

        const isWholeYear = formatiaText === CONFIG.WHOLE_YEAR_CODE;
        const isOurGroup = formatiaText === group;
        const isOurSemigroup = semigroup
          ? formatiaText === `${group}/${semigroup}`
          : false;

        if (isWholeYear || isOurGroup || isOurSemigroup) {
          if (subjects.length === 0) {
            shouldShow = true;
          } else if (disciplineCell) {
            const disciplineText = disciplineCell.textContent.toLowerCase();
            shouldShow = subjects.some((s) =>
              disciplineText.includes(s.toLowerCase())
            );
          }
        }
      }

      if (shouldShow) {
        row.style.display = "";
        if (cells.length >= CONFIG.FORMATIA_COLUMN_INDEX + 1) {
          const formatiaText =
            cells[CONFIG.FORMATIA_COLUMN_INDEX].textContent.trim();
          if (semigroup && formatiaText === `${group}/${semigroup}`) {
            row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.SEMIGROUP;
          } else if (formatiaText === group) {
            row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.GROUP;
          } else {
            row.style.backgroundColor = CONFIG.HIGHLIGHT_COLORS.WHOLE_YEAR;
          }
        }
      } else {
        row.style.display = "none";
      }
    });
  });

  showNotification();
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
