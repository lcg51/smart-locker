"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { useI18n } from "@/components/i18n-provider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const { dictionary } = useI18n()
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const options = [
    {
      value: "light",
      label: dictionary.settings.themeLight,
      description: dictionary.settings.themeLightDescription,
    },
    {
      value: "dark",
      label: dictionary.settings.themeDark,
      description: dictionary.settings.themeDarkDescription,
    },
    {
      value: "system",
      label: dictionary.settings.themeSystem,
      description: dictionary.settings.themeSystemDescription,
    },
  ] as const

  return (
    <RadioGroup
      aria-label={dictionary.settings.themeAria}
      className="gap-3"
      onValueChange={setTheme}
      value={mounted ? (theme ?? "system") : "system"}
    >
      {options.map((option) => (
        <Label
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal"
          key={option.value}
        >
          <RadioGroupItem className="mt-0.5" id={`theme-${option.value}`} value={option.value} />
          <span className="space-y-1">
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-sm text-muted-foreground">{option.description}</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  )
}
