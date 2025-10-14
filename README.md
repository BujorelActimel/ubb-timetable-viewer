# Changelog

Ideaa and the root implementation of BujorelActimel  
All notable changes to the **UBB Timetable Viewer Chrome extension** are documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [1.0.2] - 2025-10-13

### Added

- Added functionality to open the timetable URL in a new tab and automatically apply the filter when clicking the **Apply to Current Page** button in the popup.
- Implemented input validation in `popup.js` for:
  - `timetableUrl` (must be a valid HTTP or HTTPS URL)
  - `group` (must be a positive number)
  - `semigroup` (must be 1 or 2, if provided)
- Added ARIA attributes (`role="alert"`, `aria-live="assertive"`) to notifications in `content.js` for improved accessibility.
- Introduced a `CONFIG` object in `content.js` to replace hardcoded values (e.g., column indices, colors, and the `"Grupa"` string) for better maintainability.

### Changed

**`popup.js`**

- Rewrote the `applyBtn` click handler to save settings, open the timetable URL using `chrome.tabs.create`, and apply the filter after the page loads using `chrome.tabs.onUpdated`.
- Added `isValidUrl` function to validate URLs.
- Updated status messages to reflect success (**Timetable opened and filter applied successfully!**) or errors (e.g., Invalid URL or Non-timetable page).

**`content.js`**

- Modified the `applyFilter` message handler to verify the current page matches `timetableUrl` before applying the filter, returning success or error responses.
- Added a check for table existence to prevent errors on non-timetable pages.
- Enhanced the notification to display the number of filtered rows and subjects.
- Used `CONFIG` constants for column indices and styling to improve robustness.

**`manifest.json`**

- Added `tabs` permission to support creating new tabs.
- Changed content script `matches` from `*://*/*` to `*://*.cs.ubbcluj.ro/*` for improved performance and security.
- Incremented version to `1.0.2`.
