import type { Metadata } from "next";
import "./globals.css"

export const metadata: Metadata = {
  title: "Coffee Recommender",
  description: "Recomenda cafés com clima + preferências + IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-3xl p-4 md:p-8">{children}</div>
      </body>
    </html>
  );
}
