/** `ClienteResponse`: perfil comercial del usuario autenticado con el saldo de su cartera. */
export interface Cliente {
  idUsuario: string
  nombreCompleto: string
  correo: string
  nit: string | null
  dpi: string | null
  telefono: string | null
  direccion: string | null
  activo: boolean | null
  /** Monto en quetzales como texto, p. ej. `"1250.00"`. */
  saldo: string
}

/** `ClienteBusquedaResponse`: lo que necesita el mostrador (sin saldo ni DPI). */
export interface ClienteBusqueda {
  idUsuario: string
  nombreCompleto: string
  nit: string
  activo: boolean | null
}

/** `ActualizarPerfilRequest`. El nombre y el correo vienen de Identidad. */
export interface ActualizarPerfilClienteRequest {
  /** Se guarda normalizado (sin guion, mayúsculas). No puede ser CF. */
  nit?: string | null
  /** 13 dígitos. */
  dpi?: string | null
  /** 8 a 20 caracteres: dígitos, espacios, + y -. */
  telefono?: string | null
  direccion?: string | null
}

/** Mismas validaciones que `ActualizarPerfilRequest` del backend. */
export const PATRON_NIT = /^[0-9]{8,9}$/
export const PATRON_DPI = /^[0-9]{13}$/
export const PATRON_TELEFONO = /^[0-9+\- ]{8,20}$/

/** Cantidad de eventos guardados en el outbox por la republicación. */
export interface RepublicacionClientesResponse {
  clientes: number
}
