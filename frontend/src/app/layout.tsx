import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Retail Intelligence | Business Intelligence Dashboard",
  description:
    "Interactive Business Intelligence dashboard visualizing key metrics and insights from Online Retail dataset.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-emerald-500/20 selection:text-emerald-500">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

