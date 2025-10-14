document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    ["timetableUrl", "group", "semigroup", "subjects"],
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
      if (result.subjects) {
        document.getElementById("subjects").value = result.subjects.join("\n");
      }
    }
  );
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const timetableUrl = document.getElementById("timetableUrl").value.trim();
  const group = document.getElementById("group").value.trim();
  const semigroup = document.getElementById("semigroup").value.trim();
  const subjectsText = document.getElementById("subjects").value.trim();
  const subjects = subjectsText
    ? subjectsText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s)
    : [];

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
    {
      timetableUrl,
      group,
      semigroup,
      subjects,
    },
    () => {
      showStatus("Settings saved successfully!", "success");
    }
  );
});

document.getElementById("applyBtn").addEventListener("click", () => {
  const timetableUrl = document.getElementById("timetableUrl").value.trim();
  const group = document.getElementById("group").value.trim();
  const semigroup = document.getElementById("semigroup").value.trim();
  const subjectsText = document.getElementById("subjects").value.trim();
  const subjects = subjectsText
    ? subjectsText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s)
    : [];

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
    {
      timetableUrl,
      group,
      semigroup,
      subjects,
    },
    () => {
      chrome.tabs.create({ url: timetableUrl }, (tab) => {
        // Wait for the tab to load before sending the message
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
            // Remove the listener after execution
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
