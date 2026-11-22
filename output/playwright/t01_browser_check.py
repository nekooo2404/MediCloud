from playwright.sync_api import sync_playwright
import os

os.makedirs("output/playwright", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, viewport in [
        ("desktop", {"width": 1440, "height": 900}),
        ("mobile", {"width": 390, "height": 844}),
    ]:
        page = browser.new_page(viewport=viewport)
        console_errors = []
        page.on(
            "console",
            lambda message: console_errors.append(
                f"{message.type}: {message.text}"
            )
            if message.type == "error"
            else None,
        )
        page.goto("http://127.0.0.1:3000")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"output/playwright/t01-{name}.png", full_page=True)
        page.keyboard.press("Tab")
        print(
            name,
            {
                "title": page.title(),
                "has_medicloud": "MediCloud" in page.locator("body").inner_text(),
                "main_landmark_count": page.locator("main").count(),
                "heading_count": page.locator("h1,h2,h3").count(),
                "no_horizontal_overflow": page.evaluate(
                    "document.documentElement.scrollWidth <= document.documentElement.clientWidth"
                ),
                "focus_tag_after_tab": page.evaluate(
                    "document.activeElement && document.activeElement.tagName"
                ),
                "focus_text_after_tab": page.evaluate(
                    "document.activeElement && document.activeElement.textContent"
                ),
                "console_errors": console_errors,
            },
        )
        page.close()
    browser.close()
