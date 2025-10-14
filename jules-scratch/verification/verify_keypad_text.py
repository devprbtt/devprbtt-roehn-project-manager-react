import re
from playwright.sync_api import sync_playwright, expect
import sys
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Increase default timeout
    page.set_default_timeout(20000)

    # Login
    page.goto("http://localhost:8080/")
    page.get_by_role("textbox", name="Nome de Usuário").fill("admin")
    page.get_by_role("textbox", name="Senha").fill("admin123")
    page.get_by_role("button", name="Entrar").click()

    # Wait for navigation to dashboard
    expect(page).to_have_url(re.compile(r"\/"))
    page.wait_for_load_state('networkidle')

    # --- Create a new project for testing ---
    project_name = f"Projeto de Teste Keypad {int(time.time())}"

    try:
        page.get_by_role("button", name="Novo Projeto").click()
        time.sleep(1) # Allow modal to animate

        # Fill in the form in the modal
        page.get_by_label("Nome do Projeto *").fill(project_name)
        time.sleep(1) # Allow state to update

        # Click the create button
        create_button = page.locator('div[role="dialog"] button[type="submit"]:has-text("Criar Projeto")')
        expect(create_button).to_be_enabled()
        create_button.click()

        # Wait for the creation toast
        expect(page.get_by_text("Projeto criado com sucesso!")).to_be_visible(timeout=10000)
        page.wait_for_load_state('networkidle')

    except Exception as e:
        print(f"Error creating new project. Page content:\n{page.content()}", file=sys.stderr)
        page.screenshot(path="jules-scratch/verification/error_create_project.png")
        raise e

    # The new project should be selected automatically, and an alert should confirm it.
    expect(page.get_by_text(f"Projeto atual: {project_name}")).to_be_visible()

    # Navigate to keypads page
    page.get_by_role('link', name='Keypads').click()
    expect(page).to_have_url(re.compile(r"\/keypads"))
    page.wait_for_load_state('networkidle')

    # Find and open the keypad bindings
    keypad_name = "Keypad 4 Botões"
    keypad_card = page.locator(".bg-card", has_text=keypad_name)
    expect(keypad_card).to_be_visible()

    vincular_button = keypad_card.get_by_role("button", name="Vincular")
    expect(vincular_button).to_be_visible()
    vincular_button.click()

    # In the modal, update the first button's text
    button_text_input = page.locator('input[name="button-0-text"]')
    expect(button_text_input).to_be_visible()
    button_text_input.fill("Living")

    # Check the rocker checkbox for the first button
    rocker_checkbox = page.locator('input[name="button-0-rocker"]')
    expect(rocker_checkbox).to_be_visible()
    rocker_checkbox.check()

    # Save bindings
    page.get_by_role("button", name="Salvar").click()

    # Verify success toast
    expect(page.get_by_text("Vinculações salvas com sucesso!")).to_be_visible()

    # Re-open bindings to verify persistence
    vincular_button.click()

    # Verify text and rocker state
    expect(page.locator('input[name="button-0-text"]')).to_have_value("Living")
    expect(page.locator('input[name="button-0-rocker"]')).to_be_checked()

    print("Verification successful: Keypad button text and rocker state are saved.")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/keypad-text-verification.png")
    print("Screenshot saved to jules-scratch/verification/keypad-text-verification.png")

    # --- Cleanup: Delete the created project ---
    page.goto("http://localhost:8080/")
    page.wait_for_load_state('networkidle')

    try:
        project_card_container = page.locator("div.bg-card", has_text=project_name)
        expect(project_card_container).to_be_visible()

        # Click the delete button on the card
        delete_button = project_card_container.get_by_role("button").nth(2)
        delete_button.click()

        # Confirm deletion in the dialog
        page.get_by_role("button", name="Confirmar Exclusão").click()

        # Verify deletion toast
        expect(page.get_by_text("Projeto excluído com sucesso!")).to_be_visible()
        print(f"Cleanup successful: Project '{project_name}' deleted.")

    except Exception as e:
        print(f"Error during cleanup. Could not delete project '{project_name}'. Page content:\n{page.content()}", file=sys.stderr)
        page.screenshot(path="jules-scratch/verification/error_cleanup.png")
        # Do not re-raise, as the main test passed. This is just cleanup.

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)