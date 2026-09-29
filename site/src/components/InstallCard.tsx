import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { track } from "@/lib/analytics"
import { IN_APP, IOS, MOBILE, promptInstall, STANDALONE, useInstallPrompt } from "@/lib/install"
import { PRERENDER } from "@/lib/prerender"
import { T } from "@/lib/strings"

const STORE_URL = "https://chromewebstore.google.com/detail/fiogjemolijaleckapbcngibelfbpfgp"

function Shell({ heading, text, children }: { heading: string; text: string; children?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex items-start gap-3">
          <img src="icon.svg" alt="" className="size-10 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">{heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function InstallCard() {
  const prompt = useInstallPrompt()

  if (PRERENDER || !MOBILE) {
    return (
      <Shell heading={T("ctaHeading")} text={T("ctaText")}>
        <Button asChild size="sm">
          <a href={STORE_URL} rel="noopener" onClick={() => track("dodaj-do-chrome")}>
            {T("ctaButton")}
          </a>
        </Button>
      </Shell>
    )
  }
  if (STANDALONE) return null
  if (prompt) {
    return (
      <Shell heading={T("installHeading")} text={T("installText")}>
        <Button size="sm" onClick={promptInstall}>
          {T("installButton")}
        </Button>
      </Shell>
    )
  }
  const hint = IN_APP ? "installInApp" : IOS ? "installIos" : "installAndroid"
  return <Shell heading={T("installHeading")} text={`${T("installText")} ${T(hint)}`} />
}
