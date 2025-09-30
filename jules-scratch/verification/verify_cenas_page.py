from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Login
        page.goto("http://127.0.0.1:8080/login")
        page.get_by_label("Nome de Usuário").fill("admin")
        page.get_by_label("Senha").fill("admin123")
        page.get_by_role("button", name="Entrar").click()

        # Wait for dashboard to load to ensure login is complete
        expect(page.get_by_role("heading", name="Gerenciador de Projetos")).to_be_visible()

        # 2. Navigate to Cenas page
        page.get_by_role("link", name="Cenas").click()

        # 3. Verify page content and take screenshot
        expect(page.get_by_role("heading", name="Gerenciar Cenas")).to_be_visible()
        expect(page.get_by_text("Selecione um Ambiente")).to_be_visible()

        page.screenshot(path="jules-scratch/verification/cenas_page_verification.png")

        browser.close()

if __name__ == "__main__":
    run_verification()