import { env } from "../env.js";

export const mercadoPagoEnabled = Boolean(env.MERCADOPAGO_ACCESS_TOKEN);

const MP_API = "https://api.mercadopago.com";

interface PixPayment {
  id: number;
  status: string;
  qrCodeBase64: string;
  copiaECola: string;
}

/**
 * Cria uma cobrança Pix no Mercado Pago para o valor do sinal da reserva.
 * Retorna null se o Mercado Pago não estiver configurado neste ambiente
 * (o fluxo de reserva cai de volta para aprovação manual, sem Pix).
 */
export async function criarPagamentoPix(input: {
  valor: number;
  descricao: string;
  reservaId: string;
  emailPagador?: string;
  notificationUrl?: string;
}): Promise<PixPayment | null> {
  if (!mercadoPagoEnabled) return null;

  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      "X-Idempotency-Key": input.reservaId,
    },
    body: JSON.stringify({
      transaction_amount: Number(input.valor.toFixed(2)),
      description: input.descricao,
      payment_method_id: "pix",
      payer: { email: input.emailPagador || "cliente@esportetotal.com.br" },
      external_reference: input.reservaId,
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao criar pagamento Pix no Mercado Pago: ${response.status} ${body}`);
  }

  const payment = (await response.json()) as {
    id: number;
    status: string;
    point_of_interaction?: {
      transaction_data?: { qr_code_base64?: string; qr_code?: string };
    };
  };

  return {
    id: payment.id,
    status: payment.status,
    qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? "",
    copiaECola: payment.point_of_interaction?.transaction_data?.qr_code ?? "",
  };
}

export async function consultarPagamento(paymentId: string): Promise<{ status: string } | null> {
  if (!mercadoPagoEnabled) return null;

  const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
  });

  if (!response.ok) return null;

  const payment = (await response.json()) as { status: string };
  return { status: payment.status };
}
