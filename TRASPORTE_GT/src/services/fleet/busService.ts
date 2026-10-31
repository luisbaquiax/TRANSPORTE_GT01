import { clienteFlota, limpiarParametros, solicitar } from '../../api/clienteHttp'
import { normalizarPagina, type PaginaCruda } from '../../api/paginacion'
import type { Pagina } from '../../types/pagina'
import type {
  ActualizarBusRequest,
  Bus,
  CrearBusRequest,
  EstadoOperativo,
  FiltroBuses,
  RepublicacionFlotaResponse,
} from '../../types/fleetTypes'

/** GET /buses?idSucursal&estadoOperativo&activo&texto&page&size&sort → 200 paginado */
export async function listarBuses(filtro: FiltroBuses = {}, signal?: AbortSignal): Promise<Pagina<Bus>> {
  const cruda = await solicitar<PaginaCruda<Bus>>(
    { method: 'GET', url: '/buses', params: limpiarParametros(filtro), signal },
    clienteFlota,
  )
  return normalizarPagina(cruda)
}

/** GET /buses/{id} → 200 | 404 */
export function obtenerBus(id: string, signal?: AbortSignal) {
  return solicitar<Bus>({ method: 'GET', url: `/buses/${id}`, signal }, clienteFlota)
}

/** POST /buses → 201 | 409 PLACA_DUPLICADA / SUCURSAL_INACTIVA. Solo ADMIN_SUCURSAL. */
export function crearBus(datos: CrearBusRequest, signal?: AbortSignal) {
  return solicitar<Bus>({ method: 'POST', url: '/buses', data: datos, signal }, clienteFlota)
}

/** PUT /buses/{id} → 200 | 409 placa duplicada o `version` desactualizada */
export function actualizarBus(id: string, datos: ActualizarBusRequest, signal?: AbortSignal) {
  return solicitar<Bus>(
    { method: 'PUT', url: `/buses/${id}`, data: { ...datos, version: datos.version ?? null }, signal },
    clienteFlota,
  )
}

/** PATCH /buses/{id}/activo → 200 | 409 BUS_CON_VIAJES | 503 si Viajes no responde */
export function cambiarActivoBus(id: string, activo: boolean, version: number | null, signal?: AbortSignal) {
  return solicitar<Bus>(
    { method: 'PATCH', url: `/buses/${id}/activo`, data: { activo, version }, signal },
    clienteFlota,
  )
}

/** PATCH /buses/{id}/estado-operativo → 200 | 409 TRANSICION_INVALIDA (EN_TRANSITO) o versión vieja */
export function cambiarEstadoOperativoBus(
  id: string,
  estadoOperativo: EstadoOperativo,
  version: number | null,
  signal?: AbortSignal,
) {
  return solicitar<Bus>(
    { method: 'PATCH', url: `/buses/${id}/estado-operativo`, data: { estadoOperativo, version }, signal },
    clienteFlota,
  )
}

/** POST /buses/{id}/foto (multipart, campo `archivo`) → 200 | 400 FOTO_INVALIDA */
export function subirFotoBus(id: string, archivo: File, signal?: AbortSignal) {
  const datos = new FormData()
  datos.append('archivo', archivo)
  // FormData: el navegador manda multipart con su boundary (el cliente no fija Content-Type).
  return solicitar<Bus>({ method: 'POST', url: `/buses/${id}/foto`, data: datos, signal }, clienteFlota)
}

/** POST /admin/republicar-eventos → 200. Solo ADMIN_SISTEMA. */
export function republicarEventosFlota(signal?: AbortSignal) {
  return solicitar<RepublicacionFlotaResponse>(
    { method: 'POST', url: '/admin/republicar-eventos', signal },
    clienteFlota,
  )
}
