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
  title: "iAWE System - Sultan Qaboos University",
  description: "Intelligent Automated Writing Evaluation System for Sultan Qaboos University. AI-powered essay assessment and feedback.",
  keywords: ["iAWE", "AWE", "Sultan Qaboos University", "SQU", "Writing Evaluation", "Essay Assessment", "Academic Writing"],
  authors: [{ name: "Sultan Qaboos University" }],
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "iAWE System",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "iAWE System - Sultan Qaboos University",
    description: "Intelligent AI-powered essay assessment and feedback for SQU students",
    url: "https://awe.squ.edu.om",
    siteName: "iAWE System",
    type: "website",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "iAWE System - Sultan Qaboos University",
    description: "Intelligent AI-powered essay assessment and feedback",
    images: ["/icon-512x512.png"],
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
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
