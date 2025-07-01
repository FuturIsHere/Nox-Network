import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { UnreadMessagesProvider } from '@/contexts/UnreadMessagesContext';
import CleanupInitializer from './components/CleanupInitializer';
import Navbar from "./components/Navbar";

const inter = Inter({ subsets: ["latin"] });

// 🔥 CORRECT : Metadata exportée depuis un composant serveur
export const metadata: Metadata = {
  title: "Nox Network",
  description: "The New Social media",
};

// 🔥 NOUVEAU : Composant client séparé pour le contenu
function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UnreadMessagesProvider>
      {/* 🔥 AJOUT : Initialiser le nettoyage automatique */}
      <CleanupInitializer />
      
      <div className="flex w-full z-[100] fixed justify-center px-3 lg:px-16 xl:px-32 2xl:px-64 pt-3 antialiased">
        <div className="w-full max-w-screen-2xl rounded-full bg-black/65 text-white z-[100] backdrop-blur-[9.4px] border-b border-white/25 p-2 antialiased">
          <Navbar />
        </div>
      </div>
      <div className="px-4 lg:px-16 xl:px-32 2xl:px-64 pt-[100px] antialiased">
        {children}
      </div>
    </UnreadMessagesProvider>
  );
}

// 🔥 CORRECT : Composant serveur principal
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} background-body min-h-screen`}>
          <RootLayoutClient>
            {children}
          </RootLayoutClient>
        </body>
      </html>
    </ClerkProvider>
  );
}