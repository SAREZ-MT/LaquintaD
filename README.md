# La Quinta · Control de despachos con validación de existencias

Interfaz propia del Parcial 1 (Seminario de Actualización 2026-2), Parte B.
Distribuidora La Quinta S.A.S., Cali.

- **Registro de despacho:** captura solicitante, correo, código de producto, cantidad, destino y motivo, y envía la solicitud al webhook de Make.
- **Historial de movimientos:** lee las hojas `movimientos`, `inventario` e `incidentes` de Google Sheets y calcula los indicadores I1 (tiempo de respuesta) e I2 (% de despachos bajo mínimo).

La interfaz no decide. El escenario de Make consulta el inventario, calcula `saldo = existencias − cantidad` y enruta:

| Ruta | Condición | Resultado |
|---|---|---|
| 1 | saldo ≥ mínimo | APROBADO: descuenta, registra y responde |
| 2 | 0 ≤ saldo < mínimo | APROBADO CON ALERTA: igual que la ruta 1, más un correo a Compras |
| 3 | saldo < 0 | RECHAZADO: no escribe nada |
| 4 | código inexistente o cantidad inválida | Respaldo: registra el incidente y responde NO VÁLIDO |

Sitio estático (HTML, CSS y JavaScript sin librerías). La configuración está en `config.js`.
