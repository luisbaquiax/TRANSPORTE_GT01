import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { AvisoError } from '../../components/ui/Estado'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Misc'
import { useBuscarClientePorNit } from '../../hooks/customerWallet'
import { PATRON_NIT, type ClienteBusqueda } from '../../types/customerWalletTypes'

interface BuscarClienteNitProps {
  onEncontrado?: (cliente: ClienteBusqueda | null) => void
  /** El NIT escrito: la venta se enlaza a él aunque el cliente aún no tenga cuenta. */
  onNitChange?: (nit: string) => void
  deshabilitado?: boolean
}

/** Busca el cliente por NIT para enlazar una venta de mostrador (CAJERO y ADMIN_SUCURSAL). */
export function BuscarClienteNit({ onEncontrado, onNitChange, deshabilitado = false }: BuscarClienteNitProps) {
  const { ejecutar, cargando, error, reiniciar } = useBuscarClientePorNit()
  const [nit, setNit] = useState('')
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null)
  const valido = PATRON_NIT.test(nit)

  const buscar = async () => {
    if (!valido || cargando || deshabilitado) return
    const resultado = await ejecutar(nit)
    const encontrado = resultado.ok ? resultado.datos : null
    setCliente(encontrado)
    onEncontrado?.(encontrado)
  }

  return (
    <div>
      <Field
        label="NIT del cliente"
        action={
          <button type="button" className="text-button" onClick={buscar} disabled={cargando || !valido || deshabilitado}>
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>
        }
      >
        <input
          placeholder="123456789"
          inputMode="numeric"
          maxLength={9}
          value={nit}
          disabled={deshabilitado}
          onChange={(event) => {
            const valor = event.target.value.replace(/[^0-9]/g, '')
            setNit(valor)
            onNitChange?.(valor)
            setCliente(null)
            reiniciar()
            onEncontrado?.(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void buscar()
            }
          }}
        />
      </Field>
      {nit !== '' && !valido && !deshabilitado && <small className="cell-note">El NIT debe tener entre 8 y 9 dígitos.</small>}
      {cliente && (
        <div className="person-card">
          <Avatar name={cliente.nombreCompleto} small />
          <div>
            <strong>{cliente.nombreCompleto}</strong>
            <small>NIT {cliente.nit}</small>
          </div>
          <Badge tone={cliente.activo === false ? 'neutral' : 'success'}>
            {cliente.activo === false ? 'Cuenta inactiva' : 'Cliente registrado'}
          </Badge>
        </div>
      )}
      {error?.status === 404 ? (
        <div className="empty-inline">
          <div>
            <strong>No hay cliente con ese NIT</strong>
            <p>La venta quedará enlazada a este NIT y aparecerá en su historial si crea una cuenta.</p>
          </div>
        </div>
      ) : (
        <AvisoError error={error} />
      )}
    </div>
  )
}
