/** Optional workshop integration. No request body, note, loan, address, proof or user data is sent. */
export async function POST(request: Request) {
  if (request.headers.get('content-length') && request.headers.get('content-length') !== '0') {
    return Response.json({ error: 'Esta explicación solo acepta un ejemplo sintético, sin datos personales.' }, { status: 400 });
  }
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (process.env.OPENROUTER_EXPLANATION_ENABLED !== 'true' || !key || !model) {
    return Response.json({ error: 'La explicación opcional con IA no está configurada. No interviene en la validez de las pruebas ni en los pagos.' }, { status: 503 });
  }
  try {
    const result = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 250, messages: [
        { role: 'system', content: 'Explica en español sencillo. Solo ejemplo educativo sintético. No afirmes que hubo una transacción. No des asesoría financiera ni legal.' },
        { role: 'user', content: 'Un pool de prueba contiene cuatro notas de 1 XLM testnet. Una prueba de conocimiento cero demuestra pertenencia y un nullifier evita reutilizar la nota. Explica qué vínculo oculta y por qué monto, destinatario y tiempos siguen siendo públicos. La relación local con un préstamo no demuestra su liquidación.' },
      ] }),
    });
    if (!result.ok) throw new Error('upstream');
    const data = await result.json();
    const explanation = data?.choices?.[0]?.message?.content;
    if (typeof explanation !== 'string' || !explanation.trim()) throw new Error('format');
    return Response.json({ explanation: explanation.slice(0, 3000), synthetic: true, affectsProofValidity: false });
  } catch {
    return Response.json({ error: 'La explicación con IA no está disponible. La validación criptográfica es independiente.' }, { status: 502 });
  }
}
