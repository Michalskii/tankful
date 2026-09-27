import { useEffect, useState } from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { T } from "@/lib/strings"

type Theme = "system" | "light" | "dark"
const THEME_KEY = "tankful-theme"

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

export function ThemeMenu() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches))
    apply()
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {}
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={T("theme")} title={T("theme")}>
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon /> {T("themeSystem")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon /> {T("themeLight")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon /> {T("themeDark")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
