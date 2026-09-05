import { env } from "../env.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100; // Política de uso do Nominatim: máx. 1 requisição/segundo

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

async function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestAt = Date.now();
    return task();
  });

  // Evita que uma rejeição interrompa a fila para as próximas chamadas
  queue = run.catch(() => undefined);

  return run;
}

/**
 * Geocodifica um endereço via Nominatim. Deve ser chamado apenas ao criar/editar
 * uma unidade (não em tempo real por requisição pública) — o resultado é
 * persistido em latitude/longitude na tabela Unidade.
 */
export async function geocodeAddress(enderecoCompleto: string): Promise<GeocodeResult | null> {
  return throttle(async () => {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", enderecoCompleto);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");

    const contact = env.NOMINATIM_CONTACT_EMAIL ?? "contato@example.com";

    const response = await fetch(url, {
      headers: {
        "User-Agent": `EsporteTotal/1.0 (${contact})`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;

    if (!results.length) {
      return null;
    }

    const [first] = results;
    return {
      latitude: Number.parseFloat(first.lat),
      longitude: Number.parseFloat(first.lon),
    };
  });
}
