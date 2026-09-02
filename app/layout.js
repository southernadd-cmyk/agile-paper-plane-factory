import "./globals.css";

const basePath =
  process.env.GITHUB_ACTIONS === "true" ? "/agile-paper-plane-factory" : "";

export const metadata = {
  title: "The Plane Factory",
  description: "A facilitator dashboard for the Agile paper airplane factory game.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#13283a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
