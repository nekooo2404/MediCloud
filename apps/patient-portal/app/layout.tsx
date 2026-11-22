import type { Metadata, Viewport } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../styles/globals.css';
import { PortalThemeProvider } from './_components/PortalThemeProvider';

export const metadata: Metadata = {
  title: 'MediCloud — Cổng Đặt Lịch & Tiếp Nhận P0',
  description: 'Cổng đặt lịch khám bệnh nhân và tiếp nhận quầy mẫu (dữ liệu tổng hợp P0)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <PortalThemeProvider>{children}</PortalThemeProvider>
      </body>
    </html>
  );
}
