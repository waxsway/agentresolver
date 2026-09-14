import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentResolver — Capability Routing for AI Agents",
  description:
    "Free capability resolution for AI agents. Discover, compare, and execute machine services through one interface."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="ard" href="/.well-known/ard.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
