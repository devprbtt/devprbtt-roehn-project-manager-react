import re
import asyncio
from playwright.async_api import async_playwright, Page, expect

async def run(playwright):
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()

    try:
        # 1. Login
        await page.goto("http://localhost:8080/login")
        await page.get_by_label("Nome de Usuário").fill("admin")
        await page.locator("#password").fill("admin123")
        await page.get_by_role("button", name="Entrar").click()

        await expect(page).not_to_have_url(re.compile(".*login"), timeout=15000)
        print("Successfully logged in and navigated to dashboard.")

        # 2. Create Project
        await page.get_by_role("button", name="Novo Projeto").click()
        await page.get_by_label("Nome do Projeto *").fill("Test Project")
        await page.get_by_role("button", name="Criar Projeto").click()
        await expect(page.get_by_text("Projeto selecionado: Test Project")).to_be_visible(timeout=10000)
        print("Project 'Test Project' created and selected.")

        # 3. Create Area
        await page.goto("http://localhost:8080/areas")
        await page.get_by_label("Nome da Área").fill("Test Area")
        await page.get_by_role("button", name="Adicionar Área").click()
        await expect(page.get_by_text("Test Area")).to_be_visible(timeout=10000)
        print("Area 'Test Area' created.")

        # 4. Create Ambiente
        await page.goto("http://localhost:8080/ambientes")
        await page.get_by_label("Nome do Ambiente").fill("Test Ambiente")
        await page.locator("button[role='combobox']").click()
        await page.get_by_text("Test Area").click()
        await page.get_by_role("button", name="Adicionar Ambiente").click()
        await expect(page.get_by_text("Test Ambiente")).to_be_visible(timeout=10000)
        print("Ambiente 'Test Ambiente' created.")

        # 5. Create Scene
        await page.goto("http://localhost:8080/cenas")
        await page.get_by_role("button", name="Criar Cena").click()
        await page.get_by_label("Nome da Cena").fill("Test Scene")
        await page.locator("#ambiente_id").select_option(label="Test Ambiente — Test Area")
        await page.get_by_role("button", name="Salvar Cena").click()
        await expect(page.get_by_text("Test Scene")).to_be_visible(timeout=10000)
        print("Scene 'Test Scene' created.")

        # 6. Navigate to Keypads and create one
        await page.goto("http://localhost:8080/keypads")
        await page.get_by_label("Nome *").fill("Test Keypad")
        await page.locator("#hsnet").fill("110")
        await page.get_by_label("Cor *").select_option("WHITE")
        await page.get_by_label("Cor das Teclas *").select_option("BLACK")
        await page.get_by_label("Layout *").select_option("FOUR")
        await page.get_by_label("Ambiente *").select_option(label="Test Ambiente — Test Area")
        await page.get_by_role("button", name="Adicionar Keypad").click()
        await expect(page.get_by_text("Test Keypad")).to_be_visible(timeout=10000)
        print("Keypad 'Test Keypad' created.")

        # 7. Open the binding modal
        first_keypad_vincular_button = page.get_by_role("button", name="Vincular Teclas").first
        await expect(first_keypad_vincular_button).to_be_visible()
        await first_keypad_vincular_button.click()

        # 8. Verify modal is open and switch to "Cena"
        await expect(page.get_by_role("heading", name="Vincular Teclas")).to_be_visible()

        cena_radio_button = page.get_by_label("Cena").first
        await expect(cena_radio_button).to_be_visible()
        await cena_radio_button.click()

        # 9. Verify the scene dropdown appears
        await expect(page.get_by_text("— Selecione a Cena —")).to_be_visible()

        # 10. Take a screenshot
        await page.screenshot(path="jules-scratch/verification/scene-linking-modal.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        await page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)

if __name__ == "__main__":
    asyncio.run(main())