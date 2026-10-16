import styles from "./taller.module.css";

export default function TransactionHashLink({ hash }: { hash: string | null }) {
  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/i.test(hash)) {
    return <span>Hash no disponible.</span>;
  }

  return (
    <a
      className={styles.code}
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver transacción ${hash} en Stellar Expert Testnet (abre una pestaña nueva)`}
    >
      {hash}
    </a>
  );
}
