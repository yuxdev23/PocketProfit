"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** ห่อ next-themes — class strategy, default light, persist ใน localStorage (key "theme"). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}
