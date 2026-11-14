// Fala com o worker do motor: uma pergunta, uma resposta (ou um erro), com progresso no meio.
export function criarClienteDoMotor(url = new URL('./worker.js', import.meta.url)) {
  const worker = new Worker(url, { type: 'module' });
  const pendentes = new Map();
  let proximoId = 1;
  worker.onmessage = ({ data }) => {
    const p = pendentes.get(data.id);
    if (!p) return;
    if (data.progresso != null) { p.aoProgresso?.(data.progresso); return; }
    pendentes.delete(data.id);
    if (data.ok) p.resolver(data.dados); else p.rejeitar(new Error(data.erro));
  };
  worker.onerror = (e) => {
    for (const p of pendentes.values()) p.rejeitar(new Error(e.message || 'o motor parou'));
    pendentes.clear();
  };
  return {
    terminar() { worker.terminate(); pendentes.clear(); },
    chamar(tipo, entrada, aoProgresso) {
      const id = proximoId++;
      return new Promise((resolver, rejeitar) => {
        pendentes.set(id, { resolver, rejeitar, aoProgresso });
        worker.postMessage({ id, tipo, entrada });
      });
    },
  };
}
