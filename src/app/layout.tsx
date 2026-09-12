import type { Metadata } from "next";
import { Poppins, Nunito_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Poppins for headings (as on tjmtraining.com); Nunito Sans stands in for Avenir Light body copy.
const heading = Poppins({ variable: "--font-heading", subsets: ["latin"], weight: ["300", "400", "600", "700", "800"] });
const body = Nunito_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["300", "400", "600", "700"] });

export const metadata: Metadata = {
  title: `${BRAND.name} · Book a session`,
  description: "Book personal training sessions with your trainer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
