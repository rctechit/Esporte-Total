export const HORA_ABERTURA_PADRAO = "08:00";
export const HORA_FECHAMENTO_PADRAO = "22:00";

export function gerarSlots(horaAbertura: string, horaFechamento: string): string[] {
  const abertura = Number.parseInt(horaAbertura.split(":")[0], 10);
  const fechamento = Number.parseInt(horaFechamento.split(":")[0], 10);
  const slots: string[] = [];

  for (let hora = abertura; hora < fechamento; hora += 1) {
    slots.push(`${String(hora).padStart(2, "0")}:00`);
  }

  return slots;
}
