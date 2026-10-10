"""Open a receipt page in headless Chrome, press Verify independently, print the stamp.

Usage: python stranger_verify.py <receipt page URL>
Exits 0 only when the stamp reads INTACT. Called by stranger-acceptance.mjs.
"""

import sys

from playwright.sync_api import sync_playwright


def main(url: str) -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded")
        button = page.get_by_role("button", name="Verify independently")
        button.wait_for(timeout=60_000)
        button.click()
        stamp = page.locator(".stamp-press")
        stamp.wait_for(timeout=60_000)
        label = stamp.inner_text().strip()
        verdict = page.get_by_test_id("verify-verdict").inner_text().strip()
        browser.close()
    print(f"stamp: {label}")
    print(f"page says: {verdict}")
    return 0 if label == "INTACT" else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
