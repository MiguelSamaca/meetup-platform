import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { guardarConfiguracion } from '@/app/actions/configuracion'
import ImageUploader from '@/components/admin/ImageUploader'
import ColorPicker from '@/components/admin/ColorPicker'

export default async function ConfiguracionPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const { data: config } = await supabase
    .from('tenant_config')
    .select('*')
    .eq('tenant_id', profile?.tenant_id!)
    .maybeSingle()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración de empresa</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estos datos aparecen en el encabezado de las cotizaciones.
        </p>
      </div>

      <form action={guardarConfiguracion} className="space-y-6">

        {/* Identidad visual */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Identidad visual</h2>

          <ImageUploader
            label="Logo de la empresa"
            inputName="logo_url"
            currentUrl={config?.logo_url}
            tipo="logo"
            maxWidth={400}
            aspectHint="cuadrado o rectangular, fondo transparente ideal"
          />

          <ImageUploader
            label="Imagen de portada / banner"
            inputName="banner_url"
            currentUrl={config?.banner_url}
            tipo="banner"
            maxWidth={1200}
            aspectHint="16:9 recomendado"
          />

          <ColorPicker defaultValue={(config as any)?.color_primario ?? '#059669'} />
        </div>

        {/* Datos de la empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Datos de la empresa</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón social *</label>
            <input
              name="razon_social"
              defaultValue={config?.razon_social ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nombre legal de la empresa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
              <input
                name="nit"
                defaultValue={config?.nit ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="900.000.000-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                name="telefono"
                defaultValue={config?.telefono ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+57 310 000 0000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              name="direccion"
              defaultValue={config?.direccion ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Calle 123 # 45-67, Ciudad"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo comercial</label>
            <input
              name="email_comercial"
              type="email"
              defaultValue={config?.email_comercial ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ventas@empresa.com"
            />
          </div>
        </div>

        {/* Términos y condiciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">
            Términos y condiciones
          </h2>
          <textarea
            name="terminos"
            rows={4}
            defaultValue={config?.terminos ?? ''}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="Condiciones de pago, garantía, entrega… Aparecen al pie de cada cotización."
          />
        </div>

        <button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          Guardar configuración
        </button>
      </form>
    </div>
  )
}
