import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
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
          <AuthProvider>
            <ServiceWorkerRegistration />
            <a href="#main-content" className="skip-to-content">
              Skip to main content
            </a>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
