import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
