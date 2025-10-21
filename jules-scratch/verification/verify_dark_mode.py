
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Set dark mode
    page.emulate_media(color_scheme='dark')

    # Login
    page.goto("http://localhost:8080/login")
    page.get_by_label("Usuário").fill("admin")
    page.get_by_role("textbox", name="Senha").fill("admin123")
    page.get_by_role("button", name="Entrar").click()
    page.wait_for_url("http://localhost:8080/")

    # Navigate to Circuitos and take screenshot
    page.goto("http://localhost:8080/circuitos")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="jules-scratch/verification/circuitos.png")

    # Navigate to Vinculacao and take screenshot
    page.goto("http://localhost:8080/vinculacao")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="jules-scratch/verification/vinculacao.png")

    # Navigate to Projeto and take screenshot
    page.goto("http://localhost:8080/projeto")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="jules-scratch/verification/projeto.png")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
