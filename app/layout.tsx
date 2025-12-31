import './globals.css';
import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import { AntdProvider } from './providers';

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
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
