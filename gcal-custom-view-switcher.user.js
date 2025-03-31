// ==UserScript==
// @name         GCal Custom View Switcher
// @author       Andrew Waldis
// @version      2024-03-31.0
// @description  On the Google Calendar web page, adds buttons that change the number of days displayed.
// @match        https://calendar.google.com/calendar/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // We'll store the message element globally so we can remove it from anywhere
  let messageElement = null;

  //------------------------------------------------------------------------
  // Show a status message on the Settings page (e.g., "Attempting to change...")
  //------------------------------------------------------------------------
  function showStatusMessage(desiredDays) {
    // If there's already a message displayed, remove it first
    removeStatusMessage();

    // Create a container div for our status
    messageElement = document.createElement("div");
    messageElement.textContent = `Attempting to change the custom view to ${desiredDays} days...`;
    Object.assign(messageElement.style, {
      position: "fixed",
      top: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      color: "#fff",
      padding: "8px 16px",
      borderRadius: "6px",
      fontSize: "14px",
      zIndex: 999999,
    });

    document.body.appendChild(messageElement);
  }

  //------------------------------------------------------------------------
  // Remove the status message from the DOM if it exists
  //------------------------------------------------------------------------
  function removeStatusMessage() {
    if (messageElement) {
      messageElement.remove();
      messageElement = null;
    }
  }

  //------------------------------------------------------------------------
  // Observe "Settings saved" toast until first detection, or until a timeout.
  // After detecting the toast, attempt to click the "Go back" arrow and
  // remove our status message.
  //------------------------------------------------------------------------
  function observeSettingsSavedToast(timeoutMs = 5000) {
    let toastDetected = false;

    const toastObserver = new MutationObserver((mutations) => {
      if (toastDetected) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.textContent.includes("Settings saved")
          ) {
            console.log("[Tampermonkey] Toast detected:", node);
            toastDetected = true;
            toastObserver.disconnect();

            // Remove the status message
            removeStatusMessage();

            // Now click the "Go back" arrow
            const arrowButton = document.querySelector(
              'div[aria-label="Go back"][role="button"]'
            );
            if (arrowButton) {
              console.log('[Tampermonkey] Clicking the "Go back" arrow...');
              arrowButton.click();
            } else {
              console.log(
                '[Tampermonkey] Could not find the "Go back" arrow button.'
              );
            }
            return;
          }
        }
      }
    });

    // Start observing for "Settings saved"
    toastObserver.observe(document.body, { childList: true, subtree: true });

    // If toast not seen within timeoutMs, stop observing
    setTimeout(() => {
      if (!toastDetected) {
        console.log(
          `[Tampermonkey] Timed out waiting ${timeoutMs}ms for "Settings saved" toast.`
        );
        toastObserver.disconnect();

        // Remove the status message if it still exists
        removeStatusMessage();
      }
    }, timeoutMs);
  }

  //------------------------------------------------------------------------
  // Finds and clicks the option matching "<X> days" in the "Set custom view"
  // listbox. Returns true if the option was found and clicked, else false.
  //------------------------------------------------------------------------
  function setCustomView(dayString) {
    // <ul role="listbox" aria-label="Set custom view"> is the container
    const ul = document.querySelector(
      'ul[role="listbox"][aria-label="Set custom view"]'
    );
    if (!ul) {
      console.log("[Tampermonkey] Could not find the custom view listbox.");
      return false;
    }

    // Look for an element with role="option" whose text is exactly dayString
    const options = ul.querySelectorAll('[role="option"]');
    for (const opt of options) {
      const text = opt.textContent.trim();
      if (text === dayString) {
        opt.click(); // click the matching option
        console.log(`[Tampermonkey] Set custom view to "${dayString}".`);
        return true;
      }
    }
    console.log(`[Tampermonkey] No "${dayString}" option found in the listbox.`);
    return false;
  }

  //-------------------------------------------------------------------------
  // This function is intended to run when one of our custom buttons is
  // clicked and causes the settings page to load.  It kicks off other
  // functions that make the setting change and maneuver back to the main
  // page.
  //-------------------------------------------------------------------------
  function handleSettingsPage() {
    // Get the number of days set by the button click.
    const desiredDays = localStorage.getItem("setCustomViewDays");
    if (desiredDays) {
      // We only want to do this once
      localStorage.removeItem("setCustomViewDays");

      // Show the user a status message while we do the changes
      showStatusMessage(desiredDays);

      // Kick off an observer that is looking for the "Settings saved" toast,
      // and will take appropriate action when it appears (or doesn't appear).
      observeSettingsSavedToast(20000);

      // Observe DOM changes until we can set the custom view
      const observer = new MutationObserver(() => {
        if (setCustomView(`${desiredDays} days`)) {
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  //-------------------------------------------------------------------------
  // Inserts custom view shortcut buttons in a container centered at the top
  // of the main calendar page.
  // If they're already there, don't insert them again.
  //-------------------------------------------------------------------------
  function addButtonsOnMainPage() {
    // Check if we already added them
    if (document.getElementById("tampermonkey-customview-container")) {
      return; // Avoid duplicating the container
    }

    const container = document.createElement("div");
    container.id = "tampermonkey-customview-container";
    container.style.position = "fixed";
    container.style.top = "10px";
    container.style.width = "100%";
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.zIndex = 999999;

    function createButton(label, daysValue) {
      const btn = document.createElement("button");
      btn.textContent = label; // e.g. "4 days" or "7 days"
      btn.style.margin = "0 10px"; // small horizontal gap
      btn.addEventListener("click", () => {
        localStorage.setItem("setCustomViewDays", daysValue); // "4" or "7"
        // Navigate to Settings
        location.href = "https://calendar.google.com/calendar/u/0/r/settings";
      });

      return btn;
    }

    // Create the two buttons
    const btn4Days = createButton("4 days", "4");
    const btn7Days = createButton("7 days", "7");

    // Add buttons to container, and container to body
    container.appendChild(btn4Days);
    container.appendChild(btn7Days);
    document.body.appendChild(container);
  }

  //-------------------------------------------------------------------------
  // Our main entry point: Decides which function to call based on the
  // current URL.
  //-------------------------------------------------------------------------
  function init() {
    if (/\/r\/settings/.test(location.href)) {
      handleSettingsPage();
    } else {
      addButtonsOnMainPage();
    }
  }

  // 1) Call init() on page load
  init();

  // 2) Also poll for URL changes every 500 ms (handles single-page navigations).
  //    If the URL changes, we call init() again, which re-checks if we
  //    are on the main page or settings.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // re-run logic
      init();
    }
  }, 500);
})();
