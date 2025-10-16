from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Wait for server to start
    time.sleep(30)

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


    # Navigate to Projeto page
    page.goto("http://localhost:8080/projeto")

    # Open RWP modal
    page.get_by_role("button", name="Gerar RWP").click()
    time.sleep(2)

    # Verify controller dropdown in RWP modal
    controller_dropdown_rwp = page.locator('#controlador')
    expect(controller_dropdown_rwp).to_be_visible()
    expect(controller_dropdown_rwp).to_have_text("AQL-GV-M4")

    # Take a screenshot of the RWP modal before selection
    page.screenshot(path="jules-scratch/verification/rwp_modal_before.png")

    controller_dropdown_rwp.click()
    page.get_by_role("option", name="ADP-M8").click()
    expect(controller_dropdown_rwp).to_have_text("ADP-M8")

    # Take a screenshot of the RWP modal after selection
    page.screenshot(path="jules-scratch/verification/rwp_modal_after.png")

    # Close RWP modal
    page.get_by_role("button", name="Fechar").click()

    # Navigate to Dashboard
    page.goto("http://localhost:8080/")

    # Open create project modal
    page.get_by_role("button", name="Novo Projeto").click()

    # Verify controller dropdown in create project form
    time.sleep(5)
    create_form = page.locator('form:has-text("Nome do Projeto")')
    expect(create_form).to_be_visible()
    controller_dropdown_create = create_form.locator('button[role="combobox"]').nth(1)
    expect(controller_dropdown_create).to_be_visible()
    expect(controller_dropdown_create).to_have_text("AQL-GV-M4")

    # Take a screenshot of the create project form
    page.screenshot(path="jules-scratch/verification/create_project_form.png")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)