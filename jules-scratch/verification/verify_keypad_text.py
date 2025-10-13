import re
import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Login
        page.goto("http://localhost:8080/login")
        page.get_by_label("Usuário").fill("admin")
        page.get_by_role("textbox", name="Senha").fill("admin123")
        page.get_by_role("button", name="Entrar").click()

        # Wait for navigation to the dashboard and for the main heading to be visible
        expect(page.get_by_role("heading", name="Gerenciador de Projetos")).to_be_visible(timeout=10000)

        # Select project by clicking the button that contains its name
        page.get_by_role("button", name=re.compile("Projeto Residencial Exemplo")).click()

        # Wait for the success toast message
        expect(page.get_by_text("Projeto selecionado")).to_be_visible()

        # Go to Keypads page using the sidebar navigation
        page.get_by_role("link", name="Keypads").click()
        page.wait_for_url("http://localhost:8080/keypads")

        # Wait for keypads to load by checking for the first keypad card
        expect(page.locator('div.group').first).to_be_visible()

        # Open the bindings modal for the first keypad
        page.locator('div.group').first.get_by_role("button", name="Vincular Teclas").click()

        # Wait for the modal to be visible
        expect(page.get_by_role("heading", name="Vincular Teclas")).to_be_visible()

        # Fill in the text for the first button
        engraver_input = page.locator('input[id="engraver-text-0"]')
        expect(engraver_input).to_be_visible()
        engraver_input.fill("MyText")
        expect(engraver_input).to_have_value("MyText")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)