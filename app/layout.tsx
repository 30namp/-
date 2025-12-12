import './globals.css';
import { ConfigProvider, theme } from 'antd';
import faIR from 'antd/locale/fa_IR';
import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';

const vazir = Vazirmatn({ subsets: ['arabic'], weight: ['400', '700'] });

export const metadata: Metadata = {
  title: 'سامانه معاملاتی مجازی',
  description: 'پلتفرم تمرینی معاملات با داده‌های مجازی و رابط کاربری فارسی'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className={vazir.className}>
        <ConfigProvider locale={faIR} theme={{ algorithm: theme.defaultAlgorithm }}>
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
