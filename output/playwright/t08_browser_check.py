import os
import socket
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

os.makedirs("docs/evidence", exist_ok=True)
os.makedirs("output/playwright", exist_ok=True)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def wait_for_server(url: str, timeout_sec: float = 30.0) -> None:
    deadline = time.time() + timeout_sec
    last_err = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2.0) as resp:
                if resp.status == 200:
                    return
        except Exception as exc:  # noqa: BLE001
            last_err = exc
        time.sleep(0.3)
    raise RuntimeError(f"Server at {url} did not become ready: {last_err}")


def assert_no_horizontal_overflow(page, label: str) -> None:
    metrics = page.evaluate(
        "() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })"
    )
    assert metrics["scrollWidth"] <= metrics["clientWidth"], (
        f"[{label}] Horizontal overflow detected: scrollWidth={metrics['scrollWidth']} > clientWidth={metrics['clientWidth']}"
    )


def verify_tab_navigation(page, steps: int = 8) -> int:
    focused_tags = []
    for _ in range(steps):
        page.keyboard.press("Tab")
        tag = page.evaluate("() => document.activeElement ? document.activeElement.tagName : ''")
        if tag and tag != "BODY":
            focused_tags.append(tag)
    assert len(focused_tags) >= 3, f"Expected >= 3 focusable controls via Tab, got {focused_tags}"
    return len(focused_tags)


def main() -> int:
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    next_bin = os.path.join("node_modules", "next", "dist", "bin", "next")
    server = subprocess.Popen(
        ["node", next_bin, "start", "apps/patient-portal", "-H", "127.0.0.1", "-p", str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server(base_url, timeout_sec=30.0)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            console_errors: list[str] = []
            page_errors: list[str] = []
            unexpected_http_errors: list[str] = []
            page.on(
                "console",
                lambda msg: console_errors.append(f"{msg.type}: {msg.text}")
                if msg.type == "error" and "Failed to load resource" not in msg.text
                else None,
            )
            page.on("pageerror", lambda err: page_errors.append(str(err)))
            page.on(
                "response",
                lambda res: unexpected_http_errors.append(f"{res.status} {res.url}")
                if res.status >= 400
                and "/api/bff/" not in res.url
                else None,
            )

            # 1. Unauthenticated view & desktop Tab check
            page.goto(base_url, wait_until="networkidle")
            assert "MediCloud" in page.title(), f"Unexpected title: {page.title()}"
            page.get_by_role("heading", name="Đăng nhập phiên mẫu để bắt đầu đặt lịch và tiếp nhận").wait_for()
            assert_no_horizontal_overflow(page, "desktop-unauth")
            unauth_tabs = verify_tab_navigation(page, 6)

            # 2. Sign in as Patient #1 -> verify slot list -> capture desktop screenshot
            page.get_by_role("button", name="Đăng nhập Bệnh nhân mẫu #1").click()
            page.get_by_role("heading", name="Đặt lịch khám bệnh nhân & tiếp nhận theo khung giờ").wait_for()
            page.get_by_role("table").wait_for()
            assert_no_horizontal_overflow(page, "desktop-booking")
            page.screenshot(path="docs/evidence/t08-desktop.png", full_page=True)

            # 3. Book an available slot
            page.locator("button", has_text="Chọn đặt lịch").first.click()
            page.get_by_role("heading", name="Xác nhận đặt lịch khám").wait_for()
            page.get_by_role("button", name="Xác nhận đặt lịch").click()
            page.get_by_text("Đặt lịch khám thành công").wait_for()
            assert "Mã đối chiếu:" in page.locator("body").inner_text()

            # 4. Empty state simulation
            sim_button = page.get_by_role("combobox", name="Mô phỏng trạng thái P0")
            sim_button.click()
            page.get_by_role("option", name="Mô phỏng: Danh sách trống").click()
            page.get_by_role("heading", name="Hiện chưa có khung giờ khám khả dụng").wait_for()

            # 5. AC-10 Degraded mode simulation (no false confirmation)
            # First test booking attempt failing with 503 while dialog is open
            page.get_by_role("button", name="Khôi phục dữ liệu chuẩn").click()
            page.get_by_role("table").wait_for()
            page.locator("button", has_text="Chọn đặt lịch").first.click()
            page.get_by_role("heading", name="Xác nhận đặt lịch khám").wait_for()
            page.route(
                "**/api/bff/appointments",
                lambda route: route.fulfill(
                    status=503,
                    content_type="application/json",
                    body='{"error":{"code":"private_boundary_degraded","message":"Mất kết nối ranh giới lâm sàng nội bộ. Chưa có lịch hẹn nào được xác nhận.","correlation_id":"synthetic-ac10-e2e-check"}}',
                ),
            )
            page.get_by_role("button", name="Xác nhận đặt lịch").click()
            page.get_by_text("Gián đoạn ranh giới lâm sàng: chưa đặt lịch").wait_for()
            page.get_by_text("synthetic-ac10-e2e-check").first.wait_for()
            assert "Đặt lịch khám thành công" not in page.locator("body").inner_text()
            assert_no_horizontal_overflow(page, "desktop-degraded")
            page.screenshot(path="docs/evidence/t08-degraded.png", full_page=True)
            page.unroute("**/api/bff/appointments")
            page.get_by_role("button", name="Hủy").click()

            # Also verify simulation dropdown AC-10 & recovery button
            sim_button = page.get_by_role("combobox", name="Mô phỏng trạng thái P0")
            sim_button.click()
            page.get_by_role("option", name="Mô phỏng AC-10: Gián đoạn 503").click()
            page.get_by_text("Cảnh báo AC-10: Gián đoạn kết nối ranh giới lâm sàng nội bộ").wait_for()
            assert "Đặt lịch khám thành công" not in page.locator("body").inner_text()

            # Recover from degraded mode
            page.get_by_role("button", name="Khôi phục và thử kết nối lại").click()
            page.get_by_role("table").wait_for()

            # 6. Switch to Receptionist -> Staff check-in flow
            page.get_by_role("button", name="Tài khoản: Bệnh nhân mẫu #1").click()
            page.get_by_role("button", name="Chuyển sang Lễ tân quầy tiếp nhận A").click()
            page.get_by_role("button", name="Tài khoản: Lễ tân quầy tiếp nhận A").wait_for()
            page.get_by_role("button", name="Quầy tiếp nhận", exact=True).click()
            page.get_by_role("heading", name="Quầy tiếp nhận bệnh nhân (Staff Check-In)").wait_for()
            page.get_by_role("table").wait_for()
            page.locator("button", has_text="Tiếp nhận tại quầy").first.click()
            page.get_by_role("heading", name="Xác nhận tiếp nhận tại quầy?").wait_for()
            page.get_by_role("button", name="Xác nhận tiếp nhận").click()
            page.get_by_text("Đã tiếp nhận bệnh nhân tại quầy").wait_for()
            assert_no_horizontal_overflow(page, "desktop-staff")
            page.screenshot(path="docs/evidence/t08-staff.png", full_page=True)

            # 7. Tablet viewport (768x1024) - Appointments lookup & Booking table
            page.set_viewport_size({"width": 768, "height": 1024})
            page.get_by_role("button", name="Lịch hẹn & Tra cứu", exact=True).click()
            page.get_by_role("heading", name="Lịch hẹn của phiên hiện tại & tra cứu theo mã").wait_for()
            page.get_by_role("button", name="Thử tra cứu chéo cơ sở B (404)").click()
            page.get_by_role("button", name="Tra cứu lịch hẹn", exact=True).click()
            page.get_by_text("Không tìm thấy lịch hẹn hoặc không có quyền truy cập trong cơ sở hiện tại.").wait_for()
            page.get_by_role("button", name="Đặt lịch khám", exact=True).click()
            page.get_by_role("table").wait_for(timeout=8000)
            assert_no_horizontal_overflow(page, "tablet-booking")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.screenshot(path="docs/evidence/t08-tablet.png", full_page=True)
            tablet_tabs = verify_tab_navigation(page, 6)

            # 8. Mobile viewport (390x844)
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(300)
            assert page.get_by_role("table").count() == 0, "Expected mobile list view instead of wide table at 390px"
            assert_no_horizontal_overflow(page, "mobile-booking")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.screenshot(path="docs/evidence/t08-mobile.png", full_page=True)
            mobile_tabs = verify_tab_navigation(page, 6)

            assert not console_errors, f"Unexpected console errors: {console_errors}"
            assert not unexpected_http_errors, f"Unexpected asset/HTTP errors: {unexpected_http_errors}"
            assert not page_errors, f"Uncaught page errors: {page_errors}"

            print(
                f"T08 BROWSER PASS unauth_tabs={unauth_tabs} tablet_tabs={tablet_tabs} mobile_tabs={mobile_tabs} "
                f"console_errors=0 unexpected_http_errors=0"
            )
            browser.close()
        return 0
    finally:
        if server.poll() is None:
            if sys.platform == "win32":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(server.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                server.terminate()
                server.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
