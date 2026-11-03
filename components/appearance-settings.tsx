"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Always use the light theme." },
  { value: "dark", label: "Dark", description: "Always use the dark theme." },
  { value: "system", label: "System", description: "Match this device's appearance." },
] as const

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <RadioGroup
      aria-label="Appearance"
      className="gap-3"
      onValueChange={setTheme}
      value={mounted ? (theme ?? "system") : "system"}
    >
      {THEME_OPTIONS.map((option) => (
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
