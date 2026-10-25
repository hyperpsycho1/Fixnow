import type { Metadata } from 'next';
import './globals.css';
import { Header, Footer } from '@/components/chrome';
export const metadata: Metadata = { title: 'FixNow | Reliable Maintenance. One Call.', description: 'Home, garden, building and office maintenance services across Sri Lanka.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><Header/>{children}<Footer/></body></html>; }
