// ==UserScript==
// @name         GCal Custom View Switcher
// @author       Andrew Waldis
// @version      2024-03-25.0
// @description  On the Google Calendar web page, adds buttons that change the number of days displayed.
// @match        https://calendar.google.com/calendar/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**********************************************************************
     * Observe "Settings saved" toast until first detection, or until a timeout.
     * After detecting the toast, attempt to click the "Go back" arrow.
     **********************************************************************/
    function observeSettingsSavedToast(timeoutMs = 5000) {
        let toastDetected = false;

        const toastObserver = new MutationObserver(mutations => {
            if (toastDetected) return;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        node.textContent.includes('Settings saved')
                    ) {
                        console.log('[Tampermonkey] Toast detected:', node);
                        toastDetected = true;
                        toastObserver.disconnect();

                        // Now click the "Go back" arrow
                        const arrowButton = document.querySelector('div[aria-label="Go back"][role="button"]');
                        if (arrowButton) {
                            console.log('[Tampermonkey] Clicking the "Go back" arrow...');
                            arrowButton.click();
                        } else {
                            console.log('[Tampermonkey] Could not find the "Go back" arrow button.');
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
                console.log(`[Tampermonkey] Timed out waiting ${timeoutMs}ms for "Settings saved" toast.`);
                toastObserver.disconnect();
            }
        }, timeoutMs);
    }

    /**
     * Finds and clicks the option matching "<X> days" in the "Set custom view" listbox.
     * @param {string} dayString - e.g. "4 days" or "7 days"
     * @returns {boolean} true if the option was found and clicked, false otherwise
     */
    function setCustomView(dayString) {
        // <ul role="listbox" aria-label="Set custom view"> is the container
        const ul = document.querySelector('ul[role="listbox"][aria-label="Set custom view"]');
        if (!ul) {
            console.log('[Tampermonkey] Could not find the custom view listbox.');
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

    /**
     * On the Settings page, if we intended to set the custom view, do it.
     * (We've commented out automatically returning to the main page.)
     */
    function handleSettingsPage() {
        const desiredDays = localStorage.getItem('setCustomViewDays');
        if (desiredDays) {
            // We only want to do this once
            localStorage.removeItem('setCustomViewDays');

            // Watch for the "Settings saved" toast, then go back
            observeSettingsSavedToast(20000);

            // Observe DOM changes until we can set the custom view
            const observer = new MutationObserver(() => {
                if (setCustomView(`${desiredDays} days`)) {
                    observer.disconnect();
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    /**
     * On the main page, if we just set the custom view, refresh automatically.
     * Otherwise, add two buttons (4 days / 7 days) at the top center.
     */
    function handleMainPage() {
        if (localStorage.getItem('justSetCustomView') === 'true') {
            localStorage.removeItem('justSetCustomView');
            console.log('[Tampermonkey] Reloading main page to display the updated custom view.');
            location.reload(); // Force a full reload to show the new view right away
            return;
        }
        addButtonsOnMainPage();
    }

    /**
     * Inserts two buttons ("4 days", "7 days") in a container centered at the top of the page.
     * If they're already there, don't insert them again.
     */
    function addButtonsOnMainPage() {
        // Check if we already added them
        if (document.getElementById('tampermonkey-customview-container')) {
            return; // Avoid duplicating the container
        }

        // Create a container to hold the buttons
        const container = document.createElement('div');
        container.id = 'tampermonkey-customview-container';
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.width = '100%';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.zIndex = 999999;

        // Button factory
        function createButton(label, daysValue) {
            const btn = document.createElement('button');
            btn.textContent = label;  // e.g. "4 days" or "7 days"
            btn.style.margin = '0 10px';  // small horizontal gap
            btn.addEventListener('click', () => {
                localStorage.setItem('setCustomViewDays', daysValue);  // "4" or "7"
                // Navigate to Settings
                location.href = 'https://calendar.google.com/calendar/u/0/r/settings';
            });
            return btn;
        }

        // Create the two buttons
        const btn4Days = createButton('4 days', '4');
        const btn7Days = createButton('7 days', '7');

        // Add buttons to container, and container to body
        container.appendChild(btn4Days);
        container.appendChild(btn7Days);
        document.body.appendChild(container);
    }

    /**
     * Our main entry point: Decides which function to call based on the current URL.
     */
    function init() {
        if (/\/r\/settings/.test(location.href)) {
            handleSettingsPage();
        } else {
            handleMainPage();
        }
    }

    // 1) Call init() on page load
    init();

    // 2) Also poll for URL changes every 500 ms (handles single-page navigations).
    //    If the URL changes, we call init() again, which re-checks if we are on the main page or settings.
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // re-run logic
            init();
        }
    }, 500);

})();
