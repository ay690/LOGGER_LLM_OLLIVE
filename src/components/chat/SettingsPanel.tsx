import { Settings2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setDefaultModel,
  setStreamingEnabled,
  setPiiRedactionEnabled,
} from "@/store/slices/settingsSlice";
import { PUTER_MODELS } from "@/sdk/llmSdk";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </label>
  )
}

export function SettingsPanel({ className }: { className?: string }) {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((s) => s.settings)

  const currentModel = PUTER_MODELS.find((m) => m.value === settings.defaultModel)

  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Settings</span>
      </div>

      {/* Model picker — grouped by provider */}
      <div className="grid gap-1.5">
        <Label className="text-xs">Model</Label>
        <Select
          value={settings.defaultModel}
          onValueChange={(v) => dispatch(setDefaultModel(v))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {PUTER_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <Toggle
          label="Streaming"
          checked={settings.streamingEnabled}
          onChange={() => dispatch(setStreamingEnabled(!settings.streamingEnabled))}
        />
        <Toggle
          label="PII Redaction"
          checked={settings.piiRedactionEnabled}
          onChange={() => dispatch(setPiiRedactionEnabled(!settings.piiRedactionEnabled))}
        />
      </div>

      {/* Status */}
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <p>
          Active:{" "}
          <span className="font-medium text-foreground">
            {currentModel?.label ?? settings.defaultModel}
          </span>
        </p>
        <p className="mt-1 text-green-500">
          ✓ Powered by Puter.js — no API key needed
        </p>
      </div>
    </div>
  )
}