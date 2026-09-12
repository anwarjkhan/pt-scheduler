import type { Metadata } from "next";
import { Poppins, Nunito_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE } from "@/content/site";
import "./globals.css";

// Poppins for headings (as on tjmtraining.com); Nunito Sans stands in for Avenir Light body copy.
const heading = Poppins({ variable: "--font-heading", subsets: ["latin"], weight: ["300", "400", "600", "700", "800"] });
const body = Nunito_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["300", "400", "600", "700"] });

export const metadata: Metadata = {
  title: `${SITE.name} · Personal Training in Thames Ditton`,
  description: "Personal training, prehab and rehab in Thames Ditton and Surrey — book sessions with Toby online.",
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
