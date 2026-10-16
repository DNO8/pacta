"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./taller.module.css";
import { createNote, createDemoRecipient, deposit, prove, withdraw, verify, validateNote, type PrivateNote, type DepositReceipt, type PrivateProof, type PaymentReceipt } from "@/lib/private-payment/client";

type Configuracion = {
  ready: boolean;
  network: "TESTNET";
  denomination: "1";
  asset: "XLM";
  poolId: string | null;
  reason: string;
  proofSystem: string;
};

export default function TallerPagoPrivado({ embedded = false }: { embedded?: boolean }) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [accepted, setAccepted] = useState(false);
  const busyRef = useRef(false);
  const [imported, setImported] = useState(false);
  const [note, setNote] = useState<PrivateNote | null>(null);
  const [saved, setSaved] = useState(false);
  const [depositReceipt, setDepositReceipt] = useState<DepositReceipt | null>(null);
  const [proof, setProof] = useState<PrivateProof | null>(null);
  const [txHash, setTxHash] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [busy, setBusy] = useState("");
  const [operationError, setOperationError] = useState("");
  const [aiExplanation, setAiExplanation] = useState("");
  async function explain() {
    try { const response = await fetch("/api/private-payment/explain", { method: "POST" }); const data = await response.json(); setAiExplanation(response.ok ? data.explanation : data.error); } catch { setAiExplanation("Explicación IA no disponible. La prueba se valida independientemente."); }
  }

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setOperationError("");
    try { await action(); }
    catch { setOperationError("La operación no pudo completarse. No se considera un pago confirmado. Si ya enviaste una transacción, comprueba su estado antes de repetirla."); }
    finally { busyRef.current = false; setBusy(""); }
  }

  async function importNote(file: File) {
    if (file.size > 8192) throw new Error("Nota inválida");
    const candidate: unknown = JSON.parse(await file.text());
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Nota inválida");
    const n = candidate as Record<string, unknown>;
    const keys = ["version", "secret", "blinding", "commitment", "network", "poolId"];
    if (Object.keys(n).length !== keys.length || keys.some((key) => !(key in n))) throw new Error("Nota inválida");
    const field = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,76}$/.test(value) && BigInt(value) < 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
    if (n.version !== 1 || n.network !== "TESTNET" || n.poolId !== config?.poolId || typeof n.poolId !== "string" || !/^C[A-Z2-7]{55}$/.test(n.poolId) || !field(n.secret) || !field(n.blinding) || typeof n.commitment !== "string" || !/^[0-9a-f]{64}$/.test(n.commitment)) throw new Error("Nota inválida");
    const validated = n as unknown as PrivateNote;
    validateNote(validated);
    setNote(validated);
    setImported(true);
    setSaved(true);
    setAccepted(true);
  }

  function downloadNote() {
    if (!note) return;
    const blob = new Blob([JSON.stringify(note)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pacta-nota-privada-testnet.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch("/api/private-payment/config", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No pudimos comprobar la configuración del taller.");
        const value: unknown = await response.json();
        if (!value || typeof value !== "object") throw new Error("La configuración recibida no es válida.");
        const c = value as Partial<Configuracion>;
        if (typeof c.ready !== "boolean" || c.network !== "TESTNET" || c.denomination !== "1" || c.asset !== "XLM" || typeof c.reason !== "string" || typeof c.proofSystem !== "string" || !(c.poolId === null || typeof c.poolId === "string")) {
          throw new Error("La configuración no corresponde al taller de 1 XLM en Testnet.");
        }
        if (active) { setError(""); setConfig(c as Configuracion); }
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (controller.signal.aborted) setError("No se pudo verificar la configuración a tiempo. Recarga para volver a comprobarla.");
        else setError(e instanceof Error ? e.message : "No se pudo verificar la configuración.");
      })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, []);

  const ready = config?.ready === true && Boolean(config.poolId);
  const locked = !ready || Boolean(busy);
  const validRecipient = /^G[A-Z2-7]{55}$/.test(recipient.trim());

  return (
    <article className={styles.workshop}>
      {!embedded && <Link href="/demo" className={styles.back}>← Volver al préstamo</Link>}
      <header className={styles.header}>
        <p className={styles.eyebrow}>Pacta · Laboratorio opcional · Testnet</p>
        <h1>Una cuota, con un vínculo menos visible.</h1>
        <p className={styles.lead}>Explora un pago de prueba mediante un pool de denominación fija y una prueba de conocimiento cero. Se integra como experimento en la demo del préstamo, sin modificar el contrato ni su Sello.</p>
        <div className={styles.facts}>
          <div><span>Red exclusiva</span>Stellar Testnet</div>
          <div><span>Depósito fijo</span>1 XLM de prueba</div>
          <div><span>Valor real</span>Ninguno</div>
        </div>
      </header>

      <section className={styles.status} aria-live="polite" aria-busy={loading}>
        <h2>{loading ? "Comprobando disponibilidad…" : ready ? "Taller disponible en Testnet" : "Ejecución deshabilitada"}</h2>
        <p>{loading ? "Verificamos la configuración antes de habilitar cualquier operación." : error || config?.reason || "El circuito, el verificador y el pool deben estar desplegados y comprobados antes de operar."}</p>
        {!loading && !ready && <p>Por ahora puedes revisar las etapas. No se generan pagos, pruebas ni confirmaciones simuladas.</p>}
      </section>

      {operationError && <p className={styles.error} role="alert">{operationError}</p>}
      {busy && <p role="status">{busy}… Mantén esta pestaña abierta.</p>}
      <div className={styles.grid}>
        <ol className={styles.steps} aria-label="Recorrido del pago privado">
          <li className={styles.step}>
            <h2>Preparar una nota privada</h2>
            <p>La nota se crea en este navegador. Su secreto permite retirar el depósito: guarda una copia segura y no lo compartas. No se envía al servidor.</p>
            <label><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={locked || Boolean(note)} />Entiendo que perder la nota puede impedir recuperar los XLM de prueba.</label>
            <button className="btn" disabled={locked || !accepted || Boolean(note)} onClick={() => run("Preparando nota", async () => setNote(await createNote()))}>Crear nota en este navegador</button>
            {!note && <label>O recuperar una nota guardada de este pool
              <input type="file" accept="application/json,.json" disabled={locked} onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void run("Validando nota local", () => importNote(file));
              }} />
            </label>}
            {note && <div className={styles.result}>
              {imported && <p>Nota recuperada localmente. La existencia de su depósito aún debe comprobarse al generar la prueba.</p>}
              <p>Nota disponible en memoria. Cerrar o recargar esta pestaña la elimina del navegador. La descarga contiene el secreto de retiro; guárdala de forma privada.</p>
              <button className="btn" onClick={downloadNote}>Descargar respaldo privado</button>
              <label><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} disabled={Boolean(depositReceipt) || Boolean(busy)} />He guardado mi nota de forma segura.</label>
            </div>}
          </li>
          <li className={styles.step}>
            <h2>Depositar en el pool</h2>
            <p>Tu nota corresponde a 1 XLM de Testnet. Para preparar el taller se pueden crear hasta tres notas sintéticas adicionales desde la misma cuenta efímera: hasta cuatro depósitos de 1 XLM, hasta 4 XLM de prueba en total. Estas notas no representan participantes independientes y no aportan anonimato entre personas. La cadena registra cada depósito y su compromiso criptográfico; no recibe el Documento completo, el identificador del contrato ni el número de cuota.</p>
            <button className="btn" disabled={locked || !note || !saved || Boolean(depositReceipt)} onClick={() => run("Depositando en Testnet", async () => { if (note) setDepositReceipt(await deposit(note)); })}>Preparar pool de prueba (hasta 4 depósitos)</button>
            {imported && <p className={styles.result}>Nota recuperada: preparar el grupo consulta primero la cadena y no repite tu depósito.</p>}
            {depositReceipt && <p className={styles.result}>Depósito localizado en el pool. {depositReceipt.ledger ? `Confirmado en ledger ${depositReceipt.ledger}.` : "Recuperado desde el estado de la cadena."} Transacción: <span className={styles.code}>{depositReceipt.txHash}</span></p>}
          </li>
          <li className={styles.step}>
            <h2>Generar la prueba localmente</h2>
            <p>Una prueba demuestra que existe un depósito válido sin revelar cuál es. El destinatario queda ligado a la prueba para evitar que otra persona redirija el retiro.</p>
            <label>Cuenta de quien recibe (Testnet)<input type="text" value={recipient} onChange={(e) => { setRecipient(e.target.value); setProof(null); }} placeholder="G…" spellCheck={false} autoComplete="off" disabled={locked || Boolean(txHash)} /></label>
            <button className="btn" disabled={locked || Boolean(txHash)} onClick={() => run("Creando cuenta receptora de prueba", async () => { setRecipient(await createDemoRecipient()); setProof(null); })}>Crear cuenta receptora de prueba</button>
            <p>La cuenta de prueba se crea con Friendbot en Testnet. Es efímera y distinta de la cuenta que deposita; no uses esta opción para fondos reales.</p>
            <button className="btn" disabled={locked || !note || (!depositReceipt && !imported) || !validRecipient || Boolean(txHash)} onClick={() => run("Generando prueba local", async () => { if (note) { await explain(); setProof(await prove(note, recipient.trim())); } })}>Generar prueba en este navegador</button>
            {proof && <p className={styles.result}>Prueba generada para esta cuenta. Aún no se han retirado fondos.</p>}
          </li>
          <li className={styles.step}>
            <h2>Retirar al destinatario</h2>
            <p>El pool verifica la prueba y evita reutilizar la misma nota mediante un nullifier público. Solo una ejecución válida puede liberar los fondos.</p>
            <button className="btn" disabled={locked || !proof || !validRecipient || Boolean(txHash)} onClick={() => run("Enviando retiro", async () => { if (proof) setTxHash((await withdraw(proof, recipient.trim())).txHash); })}>Enviar retiro a Testnet</button>
            {txHash && <p className={styles.result}>Retiro enviado, pendiente de comprobación independiente. Transacción: <span className={styles.code}>{txHash}</span></p>}
          </li>
          <li className={styles.step}>
            <h2>Comprobar en el ledger</h2>
            <p>La confirmación requiere consultar Stellar de forma independiente y verificar el resultado del retiro. Una prueba generada o una transacción enviada todavía no son un pago confirmado.</p>
            <button className="btn" disabled={locked || !txHash || Boolean(receipt)} onClick={() => run("Consultando Stellar", async () => setReceipt(await verify(txHash, recipient.trim())))}>Consultar confirmación independiente</button>
            {receipt?.verified === true && <p className={styles.result}>Retiro comprobado: {receipt.amount} XLM de Testnet, ledger {receipt.ledger}, destinatario <span className={styles.code}>{receipt.recipient}</span>. Esta confirmación no determina el Estado del préstamo.</p>}
          </li>
        </ol>

        <aside className={styles.aside}>
          <p className={styles.eyebrow}>Privacidad con límites</p>
          <h2>Qué se oculta. Qué permanece visible.</h2>
          <h3>El vínculo entre nota y retiro</h3>
          <p>La prueba busca ocultar qué depósito financia el retiro dentro del conjunto de depósitos compatibles. Con pocos participantes, la privacidad puede ser muy limitada.</p>
          <h3>Información pública</h3>
          <ul>
            <li>El monto fijo: 1 XLM.</li>
            <li>La cuenta que deposita y la cuenta que recibe.</li>
            <li>Los horarios y las transacciones de depósito y retiro.</li>
            <li>El compromiso del depósito y el nullifier del retiro.</li>
            <li>Las notas sintéticas del taller salen de la misma cuenta; no constituyen un conjunto de personas independientes.</li>
          </ul>
          <p>Los horarios, la actividad de las cuentas y la observación de la red pueden permitir correlaciones. No es anonimato absoluto.</p>
          <h3>Explicación del flujo</h3>
          <p>{aiExplanation || "Al generar la prueba se solicita una explicación sintética por OpenRouter. Si no está configurado, se indicará; no se envía la nota ni el contrato."}</p>
          <h3>Relación con el préstamo</h3>
          <p>Asociar este retiro a una cuota es una referencia local. No acredita por sí sola que el préstamo esté pagado y no cambia su Estado ni su Sello.</p>
          <h3>Configuración comprobada</h3>
          <p>Sistema de prueba: <span className={styles.code}>{config?.proofSystem || "Pendiente de comprobar"}</span></p>
          <p>Pool: <span className={styles.code}>{config?.poolId || "Sin despliegue verificado"}</span></p>
        </aside>
      </div>
      <p className={styles.footer}>Taller experimental, sin valor real. No uses fondos de Mainnet ni información personal. El flujo de firma y sellado del préstamo sigue disponible por separado.</p>
    </article>
  );
}
