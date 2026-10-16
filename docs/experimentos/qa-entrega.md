# Comprobación de entrega · 2026-10-16

Alcance: aplicación de préstamo y laboratorio opcional existentes; no convierte el experimento BLS12-381 en una entrega conforme a otras reglas de concurso.

## Comprobado

- Web: 129 pruebas pasaron; dos pruebas de red opcionales quedaron omitidas. Lint, TypeScript y build de producción pasaron.
- Circuito: prueba genuina y rechazo de alteraciones de nullifier, destinatario, dominio y pertenencia pasaron con los artefactos existentes; no se regeneraron claves.
- Contrato: dos pruebas Rust pasaron (prueba genuina/manipulación de destinatario y pool financiado/sustitución/doble gasto). Hay dos advertencias de API de eventos obsoleta, sin errores.
- HTTP del build de producción: 200 en `/`, `/demo`, `/verificar`, `/docs`, `/pago-privado`, configuración API y los tres artefactos públicos de prueba.
- Los SHA-256 de WASM, zkey y verification key coinciden con la configuración del despliegue.
- Consulta nueva al RPC de Testnet: la transacción `7f9d07b0f3d81f9b57bda672325a6927944152b23dcd7e77d8a409a96ab74e55` tiene estado SUCCESS en ledger 5233011 y contiene un evento real de transferencia del activo nativo por 10.000.000 stroops desde el pool configurado al destinatario registrado. Esto verifica el retiro anterior; no es un retiro nuevo ejecutado desde la interfaz.
- OpenRouter sin configurar devuelve HTTP 503 y aviso explícito. No se afirma haber probado la integración activa.
- Escaneo acotado de archivos versionados para semillas Stellar, claves OpenRouter y bloques de clave privada: solo aparece la semilla pública del vector oficial SEP-53 en el prototipo histórico. No se encontró una credencial de despliegue en los archivos examinados; esto no sustituye una auditoría de secretos.

## Corrección de ciclo de vida

Ocultar el laboratorio integrado ahora conserva el componente montado, la nota, la prueba y los recibos en memoria. Reiniciar pide confirmación si se abrió el laboratorio y avisa que no cancela transacciones ya enviadas. El reinicio también se bloquea durante firma/sellado. Recargar o navegar fuera sigue eliminando el estado: es necesario descargar la nota y guardar hashes y destinatario.

## No comprobado en esta entrega

Chromium no pudo iniciar en el entorno de QA por restricción de sockets locales; el lanzamiento elevado también falló al preparar el entorno. No hubo inspección visual ni recorrido completo interactivo (passkey, sello, depósito, prueba en navegador y retiro). La revisión del flujo es de código, pruebas automatizadas y HTTP; la prueba criptográfica ejecutada fue en Node. Antes de la presentación, realiza el recorrido del [despliegue manual](../despliegue-vercel.md) en el navegador real de la URL publicada.

No se desplegó la aplicación en Vercel en esta revisión. Tampoco se ha auditado el protocolo, demostrado anonimato entre personas ni validado la liquidación legal de una cuota. Las notas sintéticas son del mismo financiador; aplica el alcance documentado del taller.
