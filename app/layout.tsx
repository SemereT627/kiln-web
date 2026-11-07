import type { Metadata } from "next";
import {
  Inter,
  Geist_Mono,
  Noto_Sans_Ethiopic,
  Fraunces,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { TRUSTED_DEVICE_COOKIE, trustedUntil } from "@/lib/device-trust";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/components/user-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "sonner";

// Generic variable names (--font-body / --font-code) so swapping the font
// family only touches this file, never globals.css.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

// Inter has no Ethiopic glyphs — bank names, notes etc. are often Amharic, so
// give them a matching fallback instead of whatever the OS picks.
const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
});

// Variable, with the SOFT axis for the marketing display face (.font-display).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Kiln",
  description: "Aesthetically pleasing ceramic store management system",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // httpOnly, so only the server can read it — passed down to switch off the
  // inactivity sign-out on a device the user chose to stay signed in on.
  const trustedDeviceUntil = trustedUntil((await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} ${notoEthiopic.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <TooltipProvider>
                <UserProvider trustedUntil={trustedDeviceUntil}>
                  {children}
                  <Toaster richColors closeButton position="top-right" />
                </UserProvider>
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
