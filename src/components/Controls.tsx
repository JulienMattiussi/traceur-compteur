import type { Settings } from '@/lib/settings'

interface ControlsProps {
  settings: Settings
  onChange: (settings: Settings) => void
  disabled: boolean
}

interface SliderProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled: boolean
  onChange: (value: number) => void
}

function Slider({ label, hint, value, min, max, step = 1, unit, disabled, onChange }: SliderProps) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm tabular-nums text-slate-500">
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-slate-900"
      />
      <span className="text-xs text-slate-500">{hint}</span>
    </label>
  )
}

export function Controls({ settings, onChange, disabled }: ControlsProps) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-4">
      <Slider
        label="Nombre de points"
        hint="Le moteur ajuste la fidélité pour tenir ce budget."
        value={settings.maxDots}
        min={50}
        max={1500}
        step={25}
        disabled={disabled}
        onChange={(value) => update('maxDots', value)}
      />

      <Slider
        label="Espacement des numéros"
        hint="Place réservée à chaque numéro sur la page. Sous 3 mm, ils se chevauchent."
        value={settings.spacingMm}
        min={2}
        max={10}
        step={0.5}
        unit="mm"
        disabled={disabled}
        onChange={(value) => update('spacingMm', value)}
      />

      <Slider
        label="Liaisons ajoutées"
        hint="Relie les traits qui s'arrêtent juste avant de se toucher. C'est le levier du nombre de séquences."
        value={settings.bridgeMm}
        min={0}
        max={16}
        unit="mm"
        disabled={disabled}
        onChange={(value) => update('bridgeMm', value)}
      />

      <Slider
        label="Ébarbage"
        hint="Supprime les barbules parasites des contours irréguliers."
        value={settings.pruneSpursBelow}
        min={0}
        max={40}
        unit="px"
        disabled={disabled}
        onChange={(value) => update('pruneSpursBelow', value)}
      />

      <Slider
        label="Taille minimale des taches"
        hint="Ignore les petites salissures et les filigranes."
        value={settings.minBlobArea}
        min={0}
        max={300}
        step={4}
        unit="px"
        disabled={disabled}
        onChange={(value) => update('minBlobArea', value)}
      />

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.threshold === 'auto'}
            disabled={disabled}
            onChange={(event) => update('threshold', event.target.checked ? 'auto' : 128)}
            className="accent-slate-900"
          />
          <span className="text-sm font-medium text-slate-800">Seuil automatique</span>
        </label>
        {settings.threshold === 'auto' ? (
          <span className="text-xs text-slate-500">
            Calculé par la méthode d&apos;Otsu, fiable sur un dessin au trait.
          </span>
        ) : (
          <Slider
            label="Seuil"
            hint="Sous cette luminosité, un pixel est considéré comme de l'encre."
            value={settings.threshold}
            min={1}
            max={254}
            disabled={disabled}
            onChange={(value) => update('threshold', value)}
          />
        )}
      </div>
    </div>
  )
}
