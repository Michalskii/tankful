import { CalculatorIcon, CarIcon, CircleHelpIcon, RouteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { track } from "@/lib/analytics"
import { T } from "@/lib/strings"

const STEPS = [
  { icon: RouteIcon, title: "aboutStep1Title", text: "aboutStep1" },
  { icon: CarIcon, title: "aboutStep2Title", text: "aboutStep2" },
  { icon: CalculatorIcon, title: "aboutStep3Title", text: "aboutStep3" },
] as const

function Steps() {
  return (
    <ol className="grid gap-4">
      {STEPS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber-ink dark:text-amber">
            <Icon className="size-4" />
          </span>
          <div className="grid gap-1">
            <p className="text-sm font-medium">{T(title)}</p>
            <p className="text-sm text-muted-foreground">{T(text)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="flex flex-col gap-3">
      <h2 id="how-heading" className="text-base font-semibold">
        {T("howHeading")}
      </h2>
      <Steps />
      <p className="text-xs text-muted-foreground">{T("aboutNote")}</p>
    </section>
  )
}

export function AboutDialog({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={className} aria-label={T("aboutButton")} onClick={() => track("jak-to-dziala")}>
          <CircleHelpIcon />
          <span className="hidden sm:inline">{T("aboutButton")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{T("aboutTitle")}</DialogTitle>
          <DialogDescription>{T("aboutLead")}</DialogDescription>
        </DialogHeader>
        <Steps />
        <p className="text-xs text-muted-foreground">{T("aboutNote")}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{T("aboutStart")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
