# Pacta: pago privado experimental (taller)

## PRD
Objetivo: añadir a la demo de préstamo una cuota experimental de 1 XLM de TESTNET mediante una prueba propia de pertenencia a un grupo de cuatro depósitos financiados. No modifica el sello ni prueba la liquidación legal del préstamo.

Usuario: participante del taller. Flujo: firmar/sellar el préstamo, abrir «Pagar cuota de forma privada», guardar nota local, financiar depósito y completar grupo de prueba, generar Groth16 en navegador, retirar a cuenta de prueba y comprobar transferencia real.

Alcance: un activo nativo, monto fijo, grupos de cuatro commitments, Circom/BLS12-381, pool Soroban con clave de verificación inmutable. Nullifier ligado al secreto y despliegue, independiente del destinatario; spend tag y entradas públicas ligan el destinatario. El contrato reconstruye el grupo desde depósitos reales.

No incluye: mainnet, auditoría, anonimato garantizado, amortización, cumplimiento legal automatizado, asociación pública préstamo-pago, custodia de secretos ni datos del contrato en IA. Las notas de cobertura sintéticas no representan usuarios independientes. Direcciones de depósito/retiro, montos, tiempos y financiador de comisiones siguen siendo observables.

Aceptación: prueba genuina verificada por Soroban; transferencia de 1 XLM testnet confirmada; rechazo de prueba alterada, destinatario alterado, grupo no financiado y doble gasto. El frontend permanece bloqueado sin configuración de despliegue verificado. Una simulación no es un pago.

IA: endpoint opcional OpenRouter con prompt fijo sintético y clave solo en servidor. OPENROUTER_EXPLANATION_ENABLED=true, OPENROUTER_API_KEY y OPENROUTER_MODEL deben configurarse por el operador. Sin credenciales, se informa explícitamente que no está disponible. IA no decide destino, importe ni validez de prueba. No habilitar públicamente sin controlar presupuesto/abuso.

## Desarrollo
- web: npm ci && npm test && npm run build
- circuits: npm ci; npm run build (genera claves nuevas, requiere redespliegue); npm test
- contracts: cargo build --locked --release --target wasm32v1-none; cargo test --locked
- Desde raíz: node scripts/crypto/deploy-testnet.mjs. Solo Testnet, cuentas efímeras Friendbot, nunca usar fondos reales.

La configuración de testnet puede caducar por reinicios de red. Los artefactos públicos de prueba se fijan por SHA-256. La ceremonia de confianza local es exclusivamente educativa, no apta para producción. No se reutiliza una zkey al cambiar el circuito.

## Referencias y atribución
Circuito de pertenencia y cliente específicos de Pacta. La ecuación/parser Groth16 se adapta de jamesbachini/CircomStellar (MIT); su setter público de VK se elimina en favor de constructor inmutable. Nethermind se usó únicamente como referencia conceptual, no se forkeó su implementación. Confirmar con organización reglas de reutilización del verificador y entrega en repo compartido.
