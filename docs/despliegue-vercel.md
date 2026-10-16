# Publicar Pacta manualmente en Vercel

Este procedimiento publica la aplicación Next.js del fork `DNO8/pacta`. No redespliega contratos ni regenera claves de prueba. El dominio histórico `pacta-demo.vercel.app` no demuestra que el fork actualizado ya esté publicado: usa la URL que Vercel asigne a tu proyecto.

## Configuración

1. Importa `DNO8/pacta` en Vercel y selecciona la rama con los cambios finales.
2. En **Root Directory**, escribe **`web`**. El `package.json` y `package-lock.json` de la aplicación están ahí, no en la raíz del repositorio.
3. Selecciona el preset **Next.js**. Usa `npm ci` para instalar y `npm run build` para construir. Conserva la salida predeterminada de Next.js; no uses exportación estática, porque hay rutas API.
4. Usa Node.js 22.x. El SDK de Stellar requiere Node.js 22.12 o superior; no selecciones 20.x.
5. No hacen falta variables de entorno para el recorrido del préstamo ni el pago experimental. Las cuentas de Testnet se crean en el navegador mediante Friendbot. No agregues claves Stellar privadas ni notas de retiro a Vercel.
6. Pulsa **Deploy** y abre la URL resultante. Vercel debe servir la app por HTTPS para WebAuthn y Web Crypto.

No se necesita `vercel.json` ni un `package.json` artificial en la raíz: la selección de `web` y el preset cubren el build. Los artefactos públicos del circuito en `web/public/private-payment/` deben estar incluidos en el commit. No cambies el circuito, el pool o los artefactos por separado.

## OpenRouter: opcional, apagado por defecto

La IA no está configurada y no es necesaria para generar o verificar pruebas. El endpoint devuelve 503 con una explicación clara si está deshabilitada. No presentes esa integración como activa.

Si decides habilitarla más adelante, configura únicamente en servidor `OPENROUTER_EXPLANATION_ENABLED=true`, `OPENROUTER_API_KEY` y `OPENROUTER_MODEL`. No uses el prefijo `NEXT_PUBLIC_`. Antes de exponerla al público, añade controles de abuso y un presupuesto: actualmente cualquier visitante puede solicitar el ejemplo sintético fijo. No se envían notas, documentos ni destinatarios a OpenRouter.

## Comprobación después de publicar

- Abre `/`, `/demo`, `/verificar`, `/docs` y `/pago-privado`.
- Revisa `/api/private-payment/config`: debe identificar Testnet, 1 XLM y el pool de `web/src/lib/private-payment/deployment.json`. `ready` comprueba la configuración registrada, no la disponibilidad actual de la red; cada operación vuelve a consultar el RPC y el pool.
- En `/demo`, propone el préstamo, firma como Ana y Larry y espera el sello. Puedes activar «firmar sin passkey (simulado)» para una presentación sin biometría. Solo un sello con enlace de transacción es real; «sin red» produce un sello expresamente simulado.
- Comprueba el sello y el caso del monto alterado. Descarga el respaldo del contrato.
- Abre el laboratorio integrado. Crea y descarga la nota privada antes de depositar. Ocultar y volver a mostrar el laboratorio conserva su estado en esa pestaña; recargar o reiniciar lo elimina. Para recuperar, importa la nota en `/pago-privado` y prepara el grupo si aún falta completarlo.
- Prepara el pool (hasta cuatro depósitos de 1 XLM), crea una cuenta receptora de prueba, genera la prueba en el navegador, envía el retiro y pulsa «Consultar confirmación independiente». Guarda el hash de retiro: el recibo solo aparece tras comprobar el evento real de transferencia desde el pool.
- Abre los enlaces de transacción en Stellar Expert **Testnet**. Nunca presentes una prueba generada, un envío pendiente o el mensaje de IA como confirmación de pago.

## Límites y recuperación

El taller usa Groth16/BLS12-381 con una ceremonia de confianza local educativa y sin auditoría. Las hasta tres notas sintéticas salen del mismo financiador: no representan personas independientes ni garantizan anonimato. Monto, cuentas y tiempos son públicos. El retiro no liquida jurídicamente el préstamo ni modifica su Sello o Estado. Se conservan los límites legales del README.

Testnet puede reiniciarse o archivar estado. Si no funciona el pool, no intentes habilitarlo cambiando un booleano: revisa la red y repite el despliegue e integración de `scripts/crypto/deploy-testnet.mjs` cuando corresponda. Actualiza juntos la configuración, artefactos y evidencia. La nota de un pool anterior no se puede usar en uno nuevo. No uses fondos reales.

Si una operación se interrumpe, consulta el hash antes de repetirla. La importación recupera la nota, no el historial local de recibos ni la cuenta receptora efímera. Guarda por separado los hashes y el destinatario. Si ya se gastó la nota, el contrato rechazará un segundo retiro.
