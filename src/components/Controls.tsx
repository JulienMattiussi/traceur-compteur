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
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-700">
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
        className="mt-1.5 w-full accent-sky-500"
      />
      <span className="mt-0.5 block text-xs leading-snug text-slate-500">{hint}</span>
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
        label="Espacement des points"
        hint="Plus il est petit, plus le tracé est fidèle. Les numéros se replacent tout seuls."
        value={settings.spacingMm}
        min={1.5}
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

      {/* Réglages d'extraction : utiles mais rarement touchés, donc repliés. */}
      <details className="border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700">
          Extraction des traits
        </summary>

        <div className="mt-3 space-y-4">
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
                className="accent-sky-500"
              />
              <span className="text-sm font-medium text-slate-800">Seuil automatique</span>
            </label>
            {settings.threshold === 'auto' ? (
              <span className="mt-0.5 block text-xs text-slate-500">
                Calculé par la méthode d&apos;Otsu, fiable sur un dessin au trait.
              </span>
            ) : (
              <div className="mt-2">
                <Slider
                  label="Seuil"
                  hint="Sous cette luminosité, un pixel est de l'encre."
                  value={settings.threshold}
                  min={1}
                  max={254}
                  disabled={disabled}
                  onChange={(value) => update('threshold', value)}
                />
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
