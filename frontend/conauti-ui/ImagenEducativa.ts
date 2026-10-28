export const LIMITE_ORIGINAL = 10_000_000;
export const LIMITE_ENVIO = 2_000_000;

export function validarImagen(
  archivo: Pick<File, "type" | "size">,
): void {
  if (
    archivo.type !== "image/jpeg" &&
    archivo.type !== "image/png"
  ) {
    throw new Error(
      "Selecciona una fotografía JPG o imagen PNG.",
    );
  }

  if (
    !Number.isFinite(archivo.size) ||
    archivo.size <= 0 ||
    archivo.size > LIMITE_ORIGINAL
  ) {
    throw new Error(
      "La imagen debe ocupar entre 1 byte y 10 MB.",
    );
  }
}

export function dimensionesImagen(
  ancho: number,
  alto: number,
): { ancho: number; alto: number } {
  if (
    !Number.isFinite(ancho) ||
    !Number.isFinite(alto) ||
    ancho <= 0 ||
    alto <= 0
  ) {
    throw new Error(
      "Las dimensiones de la imagen son inválidas.",
    );
  }

  const factor = Math.min(
    1,
    1360 / ancho,
    900 / alto,
  );

  return {
    ancho: Math.max(1, Math.floor(ancho * factor)),
    alto: Math.max(1, Math.floor(alto * factor)),
  };
}
