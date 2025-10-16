from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.goto("http://127.0.0.1:8080/")

    # Add the 'dark' class to the html element to enable dark mode
    page.evaluate("document.documentElement.classList.add('dark')")

    # Wait for the main content to be visible
    page.wait_for_selector("body")

    page.screenshot(path="jules-scratch/verification/dark_theme.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)