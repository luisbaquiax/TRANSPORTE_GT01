import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/ApiError'
import { Button } from '../../components/ui/Button'
import { AvisoError, Cargando } from '../../components/ui/Estado'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { useEditarPerfilCliente, usePerfilCliente } from '../../hooks/customerWallet'
import { PATRON_DPI, PATRON_NIT, PATRON_TELEFONO, type Cliente } from '../../types/customerWalletTypes'
import { AvisoCartera } from './AvisoCartera'

const texto = (valor: string) => valor.trim() || null

function validar(campos: { nit: string; dpi: string; telefono: string }): ApiError | null {
  const invalido = (mensaje: string) => new ApiError(400, 'VALIDACION_FALLIDA', mensaje)
  if (campos.nit !== '' && !PATRON_NIT.test(campos.nit)) return invalido('El NIT debe tener entre 8 y 9 dígitos.')
  if (campos.dpi.trim() && !PATRON_DPI.test(campos.dpi.trim())) return invalido('El DPI debe tener 13 dígitos.')
  if (campos.telefono.trim() && !PATRON_TELEFONO.test(campos.telefono.trim()))
    return invalido('El teléfono debe tener entre 8 y 20 caracteres: dígitos, espacios, + y -.')
  return null
}

function FormularioPerfil({
  cliente,
  onCancelar,
  onGuardado,
}: {
  cliente: Cliente
  onCancelar: () => void
  onGuardado: () => void
}) {
  const { ejecutar, cargando, error } = useEditarPerfilCliente()
  const [nit, setNit] = useState(cliente.nit ?? '')
  const [dpi, setDpi] = useState(cliente.dpi ?? '')
  const [telefono, setTelefono] = useState(cliente.telefono ?? '')
  const [direccion, setDireccion] = useState(cliente.direccion ?? '')
  const [errorLocal, setErrorLocal] = useState<ApiError | null>(null)

  const guardar = async (event: FormEvent) => {
    event.preventDefault()
    const invalido = validar({ nit, dpi, telefono })
    setErrorLocal(invalido)
    if (invalido) return
    const resultado = await ejecutar({
      nit: texto(nit),
      dpi: texto(dpi),
      telefono: texto(telefono),
      direccion: texto(direccion),
    })
    if (resultado.ok) onGuardado()
  }

  return (
    <form className="profile-edit-form" onSubmit={guardar}>
      <div className="form-grid two">
        <Field label="NIT" placeholder="123456789" value={nit} onChange={(event) => setNit(event.target.value.replace(/[^0-9]/g, ''))} minLength={8} maxLength={9} />
        <Field label="DPI" placeholder="2456789010101" value={dpi} onChange={(event) => setDpi(event.target.value.replace(/[^0-9]/g, ''))} minLength={13} maxLength={13} />
        <Field
          label="Teléfono"
          type="tel"
          placeholder="55551234"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          maxLength={20}
        />
        <Field
          label="Dirección"
          placeholder="Zona, municipio, departamento"
          value={direccion}
          onChange={(event) => setDireccion(event.target.value)}
          maxLength={250}
        />
      </div>
      <div className="profile-form-note">
        <Icon name="check" />
        <span>Su NIT y DPI deben ser únicos dentro del sistema.</span>
      </div>
      <AvisoError error={errorLocal ?? error} />
      <div className="row-actions">
        <Button variant="ghost" icon="close" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button type="submit" icon="check" disabled={cargando}>
          {cargando ? 'Guardando...' : 'Guardar perfil comercial'}
        </Button>
      </div>
    </form>
  )
}

/** Datos de facturación del cliente (Clientes y Cartera). El nombre y el correo vienen de Identidad. */
export function PerfilComercial({ onGuardado }: { onGuardado: (mensaje: string) => void }) {
  const perfil = usePerfilCliente()
  const [editando, setEditando] = useState(false)
  const cliente = perfil.datos

  return (
    <section>
      <div className="profile-section-title">
        <div>
          <Icon name="wallet" />
        </div>
        <span>
          <strong>Perfil comercial</strong>
          <small>Datos de facturación para compras y alquileres</small>
        </span>
      </div>
      {perfil.error ? (
        <AvisoCartera error={perfil.error} onReintentar={perfil.recargar} />
      ) : !cliente ? (
        <Cargando texto="Cargando perfil comercial..." />
      ) : editando ? (
        <FormularioPerfil
          key={cliente.idUsuario}
          cliente={cliente}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false)
            perfil.recargar()
            onGuardado('Su perfil comercial se actualizó correctamente.')
          }}
        />
      ) : (
        <>
          <div className="profile-data-grid">
            {(
              [
                ['NIT', cliente.nit],
                ['DPI', cliente.dpi],
                ['Teléfono', cliente.telefono],
                ['Dirección', cliente.direccion],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <span>{etiqueta}</span>
                <strong>{valor || '—'}</strong>
              </div>
            ))}
          </div>
          {!cliente.nit && (
            <div className="account-readonly-note">
              <Icon name="check" />
              <p>Registre su NIT para poder pagar boletos y alquileres con su cartera.</p>
            </div>
          )}
          <Button variant="secondary" icon="user" onClick={() => setEditando(true)}>
            Editar perfil comercial
          </Button>
        </>
      )}
    </section>
  )
}
