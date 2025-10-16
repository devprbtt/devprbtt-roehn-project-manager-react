import * as React from "react";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = theme === "system" ? resolvedTheme : theme;
  const isDark = current === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl bg-muted/50"
        aria-hidden="true"
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted transition"
          aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          <Sun className={`h-4 w-4 transition-transform ${isDark ? "scale-0 rotate-90" : "scale-100 rotate-0"}`} />
          <MoonStar className={`absolute h-4 w-4 transition-transform ${isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90"}`} />
          <span className="sr-only">{isDark ? "Usando modo escuro" : "Usando modo claro"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        {isDark ? "Modo claro" : "Modo escuro"}
      </TooltipContent>
    </Tooltip>
  );
}
