from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Wait for server to start
    time.sleep(10)

    # Login
    page.goto("http://localhost:8080/login")
    page.get_by_label("Usuário").fill("admin")
    page.get_by_role("textbox", name="Senha").fill("admin123")
    page.get_by_role("button", name="Entrar").click()
    page.wait_for_url("http://localhost:8080/")

    # Create a project if none is selected
    if not page.get_by_text("Projeto atual:").is_visible():
        page.get_by_role("button", name="Novo Projeto").click()
        project_name = f"Test Project {int(time.time())}"
        page.get_by_label("Nome do Projeto *").fill(project_name)
        page.get_by_role("button", name="Criar Projeto").click()
        expect(page.get_by_text("Projeto atual:")).to_be_visible()

    # Navigate to Modulos page
    page.goto("http://localhost:8080/modulos")

    # Add a controller
    expect(page.get_by_role("heading", name="Controlador")).to_be_visible()
    page.get_by_label("Tipo de Controlador *").select_option("ADP-M8")
    page.get_by_label("Nome do Controlador *").fill("My M8 Controller")
    page.get_by_label("Endereço IP *").fill("192.168.1.100")
    page.get_by_role("button", name="Adicionar Controlador").click()

    # Verify controller is displayed
    expect(page.get_by_label("Nome do Controlador")).to_have_value("My M8 Controller")
    expect(page.get_by_label("Endereço IP")).to_have_value("192.168.1.100")
    page.screenshot(path="jules-scratch/verification/modulos_controller_created.png")

    # Update controller
    page.get_by_label("Nome do Controlador").fill("My Awesome M8 Controller")
    page.get_by_label("Endereço IP").fill("192.168.1.101")
    page.get_by_role("button", name="Salvar Controlador").click()

    # Verify update
    expect(page.get_by_label("Nome do Controlador")).to_have_value("My Awesome M8 Controller")
    expect(page.get_by_label("Endereço IP")).to_have_value("192.168.1.101")
    page.screenshot(path="jules-scratch/verification/modulos_controller_updated.png")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)