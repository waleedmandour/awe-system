import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AWE System - Sultan Qaboos University",
  description: "Automated Writing Evaluation System for Sultan Qaboos University. AI-powered essay assessment and feedback.",
  keywords: ["AWE", "Sultan Qaboos University", "SQU", "Writing Evaluation", "Essay Assessment", "Academic Writing"],
  authors: [{ name: "Sultan Qaboos University" }],
  icons: {
    icon: "/squ_logo.png",
    apple: "/squ_logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AWE System",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "AWE System - Sultan Qaboos University",
    description: "AI-powered essay assessment and feedback for SQU students",
    url: "https://awe.squ.edu.om",
    siteName: "AWE System",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AWE System - Sultan Qaboos University",
    description: "AI-powered essay assessment and feedback",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a5f2a" },
    { media: "(prefers-color-scheme: dark)", color: "#1a5f2a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/squ_logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
