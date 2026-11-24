import type { Metadata } from "next";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Home | Iloilo City Public Library",
    template: "%s | Iloilo City Public Library",
  },
  description:
    "Dr. Graciano Lopez Jaena Learning Resource Center and Museum — Cybersecurity-Enhanced Public Library Management System.",
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="default" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('icpl-theme-mode');if(t==='light'||t==='dark'||t==='default'||t==='cobalt'||t==='riso'||t==='clay'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-accent/30 selection:text-white">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
