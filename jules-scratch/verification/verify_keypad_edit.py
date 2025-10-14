from playwright.sync_api import sync_playwright, Page, expect

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
        # After login, the session is set. Go directly to the page.
        page.goto("http://localhost:8080/keypads")

        # Add a wait here for the page to load properly before interacting.
        expect(page.get_by_role("heading", name="Gerenciar Keypads")).to_be_visible(timeout=10000)

        # Find the first keypad, get its name, and open the edit modal
        first_keypad_card = page.locator(".group").first
        original_name_locator = first_keypad_card.locator("h4")

        # It might take a moment for the keypads to load from the API
        expect(original_name_locator).not_to_be_empty(timeout=10000)
        original_name = original_name_locator.inner_text()

        edit_button = first_keypad_card.get_by_title("Editar keypad")
        edit_button.click()

        # Edit the name
        new_name = f"{original_name} - Editado"
        modal = page.get_by_role("dialog")
        expect(modal).to_be_visible()
        modal.get_by_label("Nome").fill(new_name)
        modal.get_by_role("button", name="Salvar Alterações").click()

        # Verify the name was updated in the list
        expect(original_name_locator).to_have_text(new_name)

        # Take screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        context.close()
        browser.close()

with sync_playwright() as playwright:
    run(playwright)