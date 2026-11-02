import { useMemo, useState } from 'react'
import { useAuth } from '../../app/providers/useAuth'
import { SeatMap } from '../../components/domain/SeatMap'
import { Button } from '../../components/ui/Button'
import { AvisoError, Cargando } from '../../components/ui/Estado'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { SectionTitle } from '../../components/ui/Misc'
import { useMapaAsientos, useVenderEnMostrador, useViajesALaVenta } from '../../hooks/tickets'
import { MAX_ASIENTOS_POR_COMPRA, type Compra } from '../../types/ticketTypes'
import { PATRON_NIT } from '../../types/customerWalletTypes'
import { etiquetaAsiento, indicesOcupados, numeroAsiento, ordenarEtiquetas } from '../../utils/asientos'
import { formatFechaCorta, formatFechaHora, formatHora, formatMonto, formatQ, hoyIso } from '../../utils/format'
import { nuevaClaveIdempotencia } from '../../utils/idempotencia'
import { BuscarClienteNit } from '../customerWallet/BuscarClienteNit'
import { DescargarBoletosButton } from '../tickets/DescargarBoletosButton'

const STEPS = ['Viaje', 'Asientos', 'Cliente y pago', 'Confirmación'] as const

function toggleSeat(seats: string[], seat: string) {
  return seats.includes(seat) ? seats.filter((item) => item !== seat) : [...seats, seat]
}

export function TicketSalesPage() {
  const { usuario } = useAuth()
  const idSucursal = usuario?.idSucursal ?? null
  const [step, setStep] = useState(1)
  const [fecha, setFecha] = useState(hoyIso)
  const [destino, setDestino] = useState('')
  const [idViaje, setIdViaje] = useState<string | null>(null)
  const [seats, setSeats] = useState<string[]>([])
  const [generico, setGenerico] = useState(true)
  const [nit, setNit] = useState('')
  const [nombreComprador, setNombreComprador] = useState('')
  const [fechaPago, setFechaPago] = useState(hoyIso)
  // Un idCompra por intento de venta: reintentarla tras un fallo de red no la registra dos veces.
  const [idCompra, setIdCompra] = useState(() => nuevaClaveIdempotencia())
  const [venta, setVenta] = useState<Compra | null>(null)
  // La venta en mostrador solo admite viajes de la sucursal del vendedor (403 en otro caso).
  const viajes = useViajesALaVenta({ idOrigen: idSucursal ?? undefined, fecha }, Boolean(idSucursal))
  const mapa = useMapaAsientos(step >= 2 && step < 4 ? idViaje : null)
  const vender = useVenderEnMostrador()

  const todos = useMemo(() => viajes.datos ?? [], [viajes.datos])
  const destinos = useMemo(() => [...new Set(todos.map((viaje) => viaje.nombreDestino))].sort(), [todos])
  const trips = destino ? todos.filter((viaje) => viaje.nombreDestino === destino) : todos
  const selectedTrip = todos.find((viaje) => viaje.idViaje === idViaje) ?? null
  const ocupados = useMemo(() => new Set(mapa.datos?.ocupados ?? []), [mapa.datos])
  const seleccion = ordenarEtiquetas(seats.filter((seat) => !ocupados.has(numeroAsiento(seat))))
  const capacity = mapa.datos?.capacidad ?? selectedTrip?.capacidad ?? 0
  const freeSeats = mapa.datos ? capacity - ocupados.size : (selectedTrip?.asientosDisponibles ?? 0)
  const maximo = Math.min(MAX_ASIENTOS_POR_COMPRA, Math.max(freeSeats, 0))
  const precio = selectedTrip ? Number(selectedTrip.precioBoleto) : 0

  const renovarIntento = () => {
    setIdCompra(nuevaClaveIdempotencia())
    vender.reiniciar()
  }

  const registrar = async () => {
    if (!selectedTrip) return
    const resultado = await vender.ejecutar({
      idCompra,
      idViaje: selectedTrip.idViaje,
      asientos: seleccion.map(numeroAsiento),
      // Sin NIT el backend la registra como consumidor final (CF).
      nitComprador: generico ? null : nit.trim() || null,
      nombreComprador: generico ? null : nombreComprador.trim() || null,
      fechaPago,
    })
    if (resultado.ok) {
      setVenta(resultado.datos)
      setStep(4)
      return
    }
    if (resultado.error.codigo === 'ASIENTO_NO_DISPONIBLE') {
      mapa.recargar()
      setIdCompra(nuevaClaveIdempotencia())
      setStep(2)
    }
  }

  const nuevaVenta = () => {
    setStep(1)
    setIdViaje(null)
    setSeats([])
    setGenerico(true)
    setNit('')
    setNombreComprador('')
    setVenta(null)
    renovarIntento()
    viajes.recargar()
  }

  // Sin NIT queda como CF; si se escribió uno, debe tener 8 o 9 dígitos.
  const nitAceptable = generico || nit === '' || PATRON_NIT.test(nit)
  const puedeContinuar = step === 1 ? Boolean(selectedTrip) : step === 2 ? seleccion.length > 0 : true

  if (!idSucursal) {
    return (
      <section className="surface">
        <div className="empty-inline">
          <Icon name="ticket" />
          <div>
            <strong>Su usuario no tiene sucursal asignada</strong>
            <p>La venta en mostrador solo está disponible para personal de una sucursal.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="stepper">
        {STEPS.map((label, index) => (
          <button
            key={label}
            className={step >= index + 1 ? 'active' : ''}
            onClick={() => index + 1 <= step && step < 4 && setStep(index + 1)}
          >
            <span>{step > index + 1 ? <Icon name="check" size={15} /> : index + 1}</span>
            <strong>{label}</strong>
            {index < STEPS.length - 1 && <i />}
          </button>
        ))}
      </div>
      <div className="sale-layout">
        <div className="surface sale-main">
          {step === 1 && (
            <>
              <SectionTitle title="Seleccione un viaje" subtitle="Salidas regulares de su sucursal con disponibilidad" />
              <div className="form-grid two">
                <Field
                  label="Fecha del viaje"
                  type="date"
                  value={fecha}
                  onChange={(event) => {
                    setFecha(event.target.value)
                    setIdViaje(null)
                    setSeats([])
                  }}
                />
                <Field label="Destino">
                  <select value={destino} onChange={(event) => setDestino(event.target.value)}>
                    <option value="">Todos los destinos</option>
                    {destinos.map((nombre) => (
                      <option key={nombre} value={nombre}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {viajes.error ? (
                <AvisoError error={viajes.error} onReintentar={viajes.recargar} />
              ) : !viajes.datos && viajes.cargando ? (
                <Cargando texto="Cargando viajes..." />
              ) : !trips.length ? (
                <div className="empty-inline">
                  <Icon name="bus" />
                  <div>
                    <strong>No hay salidas a la venta</strong>
                    <p>Elija otra fecha. Solo se listan viajes programados de su sucursal con bus asignado.</p>
                  </div>
                </div>
              ) : (
                <div className="trip-options">
                  {trips.map((trip) => (
                    <button
                      key={trip.idViaje}
                      className={trip.idViaje === idViaje ? 'selected' : ''}
                      disabled={trip.asientosDisponibles <= 0}
                      onClick={() => {
                        setIdViaje(trip.idViaje)
                        setSeats([])
                        renovarIntento()
                      }}
                    >
                      <span className="radio-dot" />
                      <div>
                        <strong>
                          {trip.nombreOrigen} → {trip.nombreDestino}
                        </strong>
                        <small>
                          {formatFechaHora(trip.fechaHoraSalida)} · {trip.placaBus ?? '—'}
                        </small>
                      </div>
                      <span>
                        <strong>{trip.asientosDisponibles} libres</strong>
                        <small>{formatMonto(trip.precioBoleto)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <SectionTitle
                title="Seleccione los asientos"
                subtitle={`Capacidad del bus ${selectedTrip?.placaBus ?? ''}: ${capacity} asientos · máximo ${MAX_ASIENTOS_POR_COMPRA} por venta`}
              />
              <AvisoError error={vender.error?.codigo === 'ASIENTO_NO_DISPONIBLE' ? vender.error : null}>
                <small>El mapa se actualizó; elija otro asiento.</small>
              </AvisoError>
              {mapa.datos ? (
                <SeatMap
                  selected={seleccion}
                  onToggle={(seat) => {
                    if (!seleccion.includes(seat) && seleccion.length >= maximo) return
                    setSeats(toggleSeat(seleccion, seat))
                    renovarIntento()
                  }}
                  count={capacity}
                  occupied={indicesOcupados(mapa.datos.ocupados)}
                />
              ) : mapa.error ? (
                <AvisoError error={mapa.error} onReintentar={mapa.recargar} />
              ) : (
                <Cargando texto="Cargando asientos..." />
              )}
            </>
          )}
          {step === 3 && (
            <>
              <SectionTitle
                title="Cliente y confirmación"
                subtitle="Enlace la venta por NIT o utilice el cliente genérico"
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={generico}
                  onChange={(event) => {
                    setGenerico(event.target.checked)
                    renovarIntento()
                  }}
                />
                <span>
                  <strong>Cliente genérico del mostrador (CF)</strong>
                  <small>Use esta opción si el cliente no proporciona NIT.</small>
                </span>
              </label>
              <div className="form-grid two">
                <BuscarClienteNit
                  deshabilitado={generico}
                  onNitChange={(valor) => {
                    setNit(valor)
                    renovarIntento()
                  }}
                  onEncontrado={(cliente) => {
                    if (cliente) setNombreComprador(cliente.nombreCompleto)
                  }}
                />
                <Field
                  label="Nombre del comprador"
                  placeholder="Opcional"
                  value={generico ? '' : nombreComprador}
                  onChange={(event) => {
                    setNombreComprador(event.target.value)
                    renovarIntento()
                  }}
                  disabled={generico}
                  maxLength={150}
                />
                <Field
                  label="Fecha de venta"
                  type="date"
                  value={fechaPago}
                  onChange={(event) => {
                    setFechaPago(event.target.value)
                    renovarIntento()
                  }}
                  required
                />
              </div>
              <AvisoError error={vender.error} />
              <div className="success-note">
                <Icon name="check" />
                <span>Los asientos se bloquearán al confirmar la venta.</span>
              </div>
            </>
          )}
          {step === 4 && venta && (
            <>
              <SectionTitle title="Venta registrada" subtitle="Boletos emitidos y asientos bloqueados" />
              <div className="success-note">
                <Icon name="check" />
                <span>
                  Venta registrada en mostrador.{' '}
                  {venta.nitComprador && venta.nitComprador !== 'CF'
                    ? `Quedó enlazada al NIT ${venta.nitComprador} y aparecerá en su historial aunque cree una cuenta en el futuro.`
                    : 'Se registró como consumidor final (CF).'}
                </span>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Boletos</span>
                  <strong>{venta.asientos.map((boleto) => boleto.codigo).join(', ')}</strong>
                </div>
                <div>
                  <span>Viaje</span>
                  <strong>
                    {selectedTrip ? `${selectedTrip.nombreOrigen} → ${selectedTrip.nombreDestino}` : '—'}
                  </strong>
                </div>
                <div>
                  <span>Salida</span>
                  <strong>{formatFechaHora(selectedTrip?.fechaHoraSalida)}</strong>
                </div>
                <div>
                  <span>Asientos</span>
                  <strong>{venta.asientos.map((boleto) => etiquetaAsiento(boleto.numeroAsiento)).join(', ')}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatMonto(venta.montoTotal)}</strong>
                </div>
              </div>
              <DescargarBoletosButton compra={venta} variant="primary" texto="Imprimir boletos (PDF)" />
            </>
          )}
          <div className="sale-actions">
            <Button variant="ghost" disabled={step === 1 || step === 4 || vender.cargando} onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)} disabled={!puedeContinuar}>
                Continuar
              </Button>
            )}
            {step === 3 && (
              <Button onClick={registrar} disabled={vender.cargando || !seleccion.length || !nitAceptable}>
                {vender.cargando ? 'Registrando...' : 'Registrar venta'}
              </Button>
            )}
            {step === 4 && <Button onClick={nuevaVenta}>Nueva venta</Button>}
          </div>
        </div>
        <aside className="surface order-summary">
          <span className="eyebrow">Resumen</span>
          <h3>{selectedTrip ? `${selectedTrip.nombreOrigen} → ${selectedTrip.nombreDestino}` : '—'}</h3>
          <p>
            {selectedTrip
              ? `${formatFechaCorta(selectedTrip.fechaHoraSalida)} · ${formatHora(selectedTrip.fechaHoraSalida)}`
              : 'Seleccione un viaje'}
          </p>
          <dl>
            <div>
              <dt>Asientos</dt>
              <dd>{seleccion.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Cantidad</dt>
              <dd>{seleccion.length}</dd>
            </div>
            <div>
              <dt>Disponibles</dt>
              <dd>{selectedTrip ? Math.max(freeSeats, 0) : '—'}</dd>
            </div>
            <div>
              <dt>Precio unitario</dt>
              <dd>{selectedTrip ? formatMonto(selectedTrip.precioBoleto) : '—'}</dd>
            </div>
          </dl>
          <div className="summary-total">
            <span>Total</span>
            <strong>{formatQ(seleccion.length * precio)}</strong>
          </div>
        </aside>
      </div>
    </>
  )
}
