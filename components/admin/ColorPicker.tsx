'use client'

const SWATCHES = [
  '#059669', // esmeralda
  '#2563eb', // azul
  '#dc2626', // rojo
  '#d97706', // naranja
  '#7c3aed', // violeta
  '#0891b2', // cian
  '#374151', // gris oscuro
  '#000000', // negro
]

interface Props {
  defaultValue?: string
}

export default function ColorPicker({ defaultValue = '#059669' }: Props) {
  function applyColor(color: string) {
    const input = document.querySelector('input[name="color_primario"]') as HTMLInputElement
    if (input) input.value = color
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Color principal de la marca
      </label>
      <p className="text-xs text-gray-400 mb-3">
        Se aplica en el encabezado de la cotización, la marca de los productos y el subtotal.
      </p>
      <div className="flex items-center gap-4">
        <input
          type="color"
          name="color_primario"
          defaultValue={defaultValue}
          className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer p-0.5"
        />
        <div className="flex gap-2 flex-wrap">
          {SWATCHES.map(c => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => applyColor(c)}
              className="w-8 h-8 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Haz clic en un color de muestra o usa el selector para elegir cualquier color.
      </p>
    </div>
  )
}
