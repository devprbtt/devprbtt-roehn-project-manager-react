import re
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the entire import/export process.
    1. Logs in to the application.
    2. Creates a new project to be used for the test.
    3. Exports the newly created project to a JSON file.
    4. Imports the same project from the downloaded file.
    5. Verifies that the imported project appears on the dashboard.
    6. Takes a screenshot of the final state.
    """
    # 1. Login
    print("Navigating to login page...")
    page.goto("http://localhost:8080/login")
    page.get_by_label("Usuário").fill("admin")
    page.get_by_role("textbox", name="Senha").fill("admin123")
    page.get_by_role("button", name="Entrar").click()
    print("Login successful.")

    # Wait for navigation to the dashboard
    expect(page).to_have_url(re.compile(r".*/$"))
    expect(page.get_by_role("heading", name="Gerenciador de Projetos")).to_be_visible()
    print("Dashboard loaded.")

    # 2. Create a new project
    project_name = "Projeto de Teste para Export"
    page.get_by_role("button", name="Novo Projeto").click()

    # Wait for the form to appear
    create_form = page.get_by_text("Criar Novo Projeto")
    expect(create_form).to_be_visible()

    page.get_by_label("Nome do Projeto").fill(project_name)
    page.get_by_role("button", name="Criar Projeto").click()
    print(f"Creating project: {project_name}")

    # Wait for the project card to appear in the grid first
    expect(page.get_by_role("heading", name=project_name)).to_be_visible()
    print("Project card is visible.")

    # Then, wait for the export button to appear, which confirms the project is selected
    expect(page.get_by_role("button", name="Exportar JSON")).to_be_visible()
    print("Project created and selected.")

    # 3. Export the project
    print("Exporting project...")
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Exportar JSON").click()

    download = download_info.value
    download_path = f"jules-scratch/verification/{download.suggested_filename}"
    download.save_as(download_path)
    print(f"Project exported to: {download_path}")
    assert download.failure() is None, "Download should not fail"

    # 4. Import the project
    print("Importing project from file...")
    page.get_by_label("Importar Projeto").set_input_files(download_path)
    page.get_by_role("button", name="Importar JSON").click()

    # 5. Verify the import
    print("Verifying import...")
    # The new project will have a "(cópia 1)" suffix
    imported_project_name = f"{project_name} (cópia 1)"

    # Check for the success toast message
    expect(page.get_by_text(f"Projeto '{imported_project_name}' importado com sucesso!")).to_be_visible()

    # Check that the new project is listed in the grid
    expect(page.get_by_role("heading", name=imported_project_name)).to_be_visible()
    print("Import verification successful.")

    # 6. Take a screenshot
    screenshot_path = "jules-scratch/verification/verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
        finally:
            browser.close()

if __name__ == "__main__":
    main()