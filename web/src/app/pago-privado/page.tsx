import type { Metadata } from "next";
import TallerPagoPrivado from "./TallerPagoPrivado";

export const metadata: Metadata = { title: "Taller de pago privado · Pacta" };

export default function PaginaPagoPrivado() {
  return <TallerPagoPrivado />;
}
