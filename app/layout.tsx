import type { Metadata, Viewport } from "next";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { AppProviders } from "../src/components/AppProviders";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "Recall — DSA practice journal",
  description: "A focused practice journal for data structures and algorithms.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#151a17" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const convexUrl = requiredServerEnvironmentVariable("CONVEX_URL");
  const { accessToken: _accessToken, ...initialAuth } = await withAuth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <AppProviders convexUrl={convexUrl} initialAuth={initialAuth}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

function requiredServerEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const themeInitializationScript = `
try {
  const savedTheme = localStorage.getItem("recall-theme");
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch {}
`;
