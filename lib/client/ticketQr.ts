import { toDataURL } from "qrcode";

/** A real, high-contrast QR, with a four-module quiet zone for door scanners. */
export function ticketQrDataUrl(value: string): Promise<string> {
  return toDataURL(value, { margin: 4, width: 364, errorCorrectionLevel: "M", color: { dark: "#14110f", light: "#fbf6ee" } });
}
