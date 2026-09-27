import { useState } from "react"
import { CalculatorIcon, CarIcon, CircleHelpIcon, RouteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { track } from "@/lib/analytics"
import { PRERENDER } from "@/lib/prerender"
import { T } from "@/lib/strings"

const SEEN_KEY = "tankful-intro-seen"

function firstVisit() {
  if (PRERENDER || new URLSearchParams(location.search).has("from")) return false
  try {
    return !localStorage.getItem(SEEN_KEY)
  } catch {
    return false
  }
}

const STEPS = [
  { icon: RouteIcon, title: "aboutStep1Title", text: "aboutStep1" },
  { icon: CarIcon, title: "aboutStep2Title", text: "aboutStep2" },
  { icon: CalculatorIcon, title: "aboutStep3Title", text: "aboutStep3" },
] as const

export function AboutDialog() {
  const [open, setOpen] = useState(firstVisit)

  function change(value: boolean) {
    setOpen(value)
    if (!value) {
      try {
        localStorage.setItem(SEEN_KEY, "1")
      } catch {}
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={T("aboutButton")} onClick={() => track("jak-to-dziala")}>
          <CircleHelpIcon />
          <span className="hidden sm:inline">{T("aboutButton")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{T("aboutTitle")}</DialogTitle>
          <DialogDescription>{T("aboutLead")}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-4">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4" />
              </span>
              <div className="grid gap-1">
                <p className="font-medium">{T(title)}</p>
                <p className="text-muted-foreground">{T(text)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{T("aboutNote")}</p>
        <DialogFooter>
          <Button onClick={() => change(false)}>{T("aboutStart")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
