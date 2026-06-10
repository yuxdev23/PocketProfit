"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** ห่อ next-themes — class strategy, default dark, persist ใน localStorage (key "theme"). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}
