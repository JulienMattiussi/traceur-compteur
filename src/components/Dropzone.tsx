import { useRef, useState } from 'react'

interface DropzoneProps {
  onFile: (file: File) => void
  busy: boolean
  currentName: string | null
}

export function Dropzone({ onFile, busy, currentName }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [hovering, setHovering] = useState(false)

  const take = (files: FileList | null): void => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setHovering(true)
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(event) => {
        event.preventDefault()
        setHovering(false)
        take(event.dataTransfer.files)
      }}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        hovering ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'
      }`}
    >
      <p className="text-sm text-slate-600">
        {currentName ? (
          <>
            Image chargée : <span className="font-medium text-slate-900">{currentName}</span>
          </>
        ) : (
          'Glisse un dessin au trait ici (coloriage, illustration, logo)'
        )}
      </p>

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? 'Analyse en cours...' : 'Choisir une image'}
      </button>

      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="Choisir une image"
        className="hidden"
        onChange={(event) => take(event.target.files)}
      />
    </div>
  )
}
