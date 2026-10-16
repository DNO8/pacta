import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TransactionHashLink from "./TransactionHashLink";

describe("TransactionHashLink", () => {
  it.each(["ab".repeat(32), "AB01".repeat(16)])("links the full valid hash to Testnet: %s", (hash) => {
    const html = renderToStaticMarkup(createElement(TransactionHashLink, { hash }));
    expect(html).toContain(`href="https://stellar.expert/explorer/testnet/tx/${hash}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(`>${hash}</a>`);
    expect(html).toContain(`aria-label="Ver transacción ${hash} en Stellar Expert Testnet (abre una pestaña nueva)"`);
  });

  it.each([null, "", "recovered", "a".repeat(63), "a".repeat(65), "g".repeat(64), `${"a".repeat(64)}?network=public`, ` ${"a".repeat(64)}`])("does not invent a link for an unavailable or invalid hash: %s", (hash) => {
    expect(renderToStaticMarkup(createElement(TransactionHashLink, { hash }))).toBe("<span>Hash no disponible.</span>");
  });
});
