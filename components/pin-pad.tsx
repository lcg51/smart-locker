"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface PinPadProps {
  onComplete: (pin: string) => void
  maxLength?: number
}

export function PinPad({ onComplete, maxLength = 4 }: PinPadProps) {
  const [pin, setPin] = useState("")

  const handleNumberClick = (num: string) => {
    if (pin.length < maxLength) {
      const newPin = pin + num
      setPin(newPin)
      if (newPin.length === maxLength) {
        onComplete(newPin)
        setPin("") // Reset after completion so user can retry if PIN is wrong
      }
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
  }

  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]

  return (
    <div className="flex flex-col items-center gap-8">
      {/* PIN Display */}
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className="h-14 w-14 rounded-xl border-2 border-border bg-background flex items-center justify-center"
          >
            {i < pin.length && <div className="h-4 w-4 rounded-full bg-primary" />}
          </div>
        ))}
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-3">
        {numbers.map((num) => (
          <Button
            key={num}
            variant="outline"
            size="lg"
            onClick={() => handleNumberClick(num)}
            className="h-16 w-16 text-xl font-semibold"
          >
            {num}
          </Button>
        ))}
        <div className="col-start-3">
          <Button aria-label="Delete last digit" variant="ghost" size="lg" onClick={handleDelete} className="h-16 w-16" disabled={pin.length === 0}>
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}
