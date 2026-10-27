import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SyncCoordinator } from "@/components/sync-coordinator";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Engineer OS — Open-Source AI Engineering Learning Platform",
  description: "Production-grade open-source learning platform for AI engineering, from fundamentals to advanced LLMs, RAG, and production deployment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        <ThemeProvider>
          {/* SessionProvider intentionally not mounted: no client code consumes
              useSession(), and Auth.js v5-beta's provider drives the repeated
              /api/auth/session polling behind BUG-05. signIn/signOut work
              without it; server-side session checks are unchanged. */}
          <SyncCoordinator />
          <ServiceWorkerRegistration />
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
