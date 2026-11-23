"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { setLocale } from "@/app/actions/locale"
import { useI18n } from "@/components/i18n-provider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Locale } from "@/lib/i18n/config"

export function LanguageSettings({ initialLocale }: { initialLocale: Locale }) {
  const { dictionary } = useI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    if (value !== "en" && value !== "es") return
    startTransition(async () => {
      await setLocale(value)
      router.refresh()
    })
  }

  return (
    <RadioGroup
      aria-label={dictionary.settings.languageTitle}
      className="gap-3"
      disabled={isPending}
      onValueChange={handleChange}
      value={initialLocale}
    >
      {(
        [
          { value: "en", label: dictionary.settings.languageEnglish },
          { value: "es", label: dictionary.settings.languageSpanish },
        ] as const
      ).map((option) => (
        <Label
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal"
          key={option.value}
        >
          <RadioGroupItem id={`language-${option.value}`} value={option.value} />
          <span className="text-sm font-medium">{option.label}</span>
        </Label>
      ))}
    </RadioGroup>
  )
}
