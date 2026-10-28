export type IntentoAcademico = {
  id: string;
  topic: string;
  question: string;
  correct: boolean;
  answered_at: string;
};

export type ResumenMateria = {
  attempts: number;
  correct: number;
  distinct_exercises: number;
  verified_level: number;
  level_note: string;
};

export type ResumenGeneral = {
  topics: Record<string, ResumenMateria>;
};

export type ActividadDia = {
  fecha: string;
  etiqueta: string;
  ejercicios: number;
  correctos: number;
};

const ZONA = "America/Lima";

const FORMATO_FECHA = new Intl.DateTimeFormat(
  "es-PE",
  {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
);

function fechaPeru(fecha: Date): string {
  const partes = FORMATO_FECHA.formatToParts(fecha);

  const valores = Object.fromEntries(
    partes.map((parte) => [
      parte.type,
      parte.value,
    ]),
  );

  return [
    valores.year,
    valores.month,
    valores.day,
  ].join("-");
}

function fechaAnterior(
  referencia: string,
  dias: number,
): string {
  const [year, month, day] =
    referencia.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day - dias),
  );

  return date.toISOString().slice(0, 10);
}

function etiquetaDia(fecha: string): string {
  const date = new Date(
    `${fecha}T12:00:00.000Z`,
  );

  const nombres = [
    "Dom",
    "Lun",
    "Mar",
    "Mié",
    "Jue",
    "Vie",
    "Sáb",
  ];

  return nombres[date.getUTCDay()];
}

function cantidad(valor: unknown): number {
  return typeof valor === "number" &&
    Number.isFinite(valor)
    ? Math.max(0, Math.floor(valor))
    : 0;
}

export function calcularAnalitica(
  historial: IntentoAcademico[],
  resumen: ResumenGeneral,
  ahora: Date = new Date(),
) {
  const hoy = fechaPeru(ahora);

  const porDia = new Map<
    string,
    { ejercicios: number; correctos: number }
  >();

  for (const intento of historial) {
    const fecha = new Date(
      intento.answered_at,
    );

    if (Number.isNaN(fecha.getTime())) {
      continue;
    }

    const clave = fechaPeru(fecha);

    const anterior = porDia.get(clave) ?? {
      ejercicios: 0,
      correctos: 0,
    };

    anterior.ejercicios += 1;

    if (intento.correct === true) {
      anterior.correctos += 1;
    }

    porDia.set(clave, anterior);
  }

  const semana: ActividadDia[] = [];

  for (let dias = 6; dias >= 0; dias--) {
    const fecha = fechaAnterior(
      hoy, dias,
    );

    const datos = porDia.get(fecha) ?? {
      ejercicios: 0,
      correctos: 0,
    };

    semana.push({
      fecha,
      etiqueta: etiquetaDia(fecha),
      ejercicios: datos.ejercicios,
      correctos: datos.correctos,
    });
  }

  const diasActivos = semana.filter(
    (dia) => dia.ejercicios > 0,
  ).length;

  const hoyActivo =
    (porDia.get(hoy)?.ejercicios ?? 0) > 0;

  const ayer = fechaAnterior(hoy, 1);

  const ayerActivo =
    (porDia.get(ayer)?.ejercicios ?? 0) > 0;

  let constancia = 0;

  if (hoyActivo || ayerActivo) {
    let desplazamiento = hoyActivo ? 0 : 1;

    while (desplazamiento <= 100) {
      const fecha = fechaAnterior(
        hoy, desplazamiento,
      );

      if (
        (porDia.get(fecha)?.ejercicios ?? 0) === 0
      ) {
        break;
      }

      constancia += 1;
      desplazamiento += 1;
    }
  }

  const materias = [
    "fracciones",
    "ecuaciones",
  ].map((tema) => {
    const datos = resumen.topics?.[tema];

    const intentos = cantidad(
      datos?.attempts,
    );

    const correctos = Math.min(
      intentos,
      cantidad(datos?.correct),
    );

    const porcentaje = intentos > 0
      ? Math.round(
          (correctos / intentos) * 100,
        )
      : 0;

    return {
      tema,
      intentos,
      correctos,
      porcentaje,
      nivel: cantidad(
        datos?.verified_level,
      ),
    };
  });

  const totalIntentos = materias.reduce(
    (sum, materia) =>
      sum + materia.intentos,
    0,
  );

  const totalAciertos = materias.reduce(
    (sum, materia) =>
      sum + materia.correctos,
    0,
  );

  const porcentajeGeneral =
    totalIntentos > 0
      ? Math.round(
          (totalAciertos / totalIntentos) * 100,
        )
      : 0;

  const maximoDia = Math.max(
    1,
    ...semana.map(
      (dia) => dia.ejercicios,
    ),
  );

  return {
    totalIntentos,
    totalAciertos,
    porcentajeGeneral,
    semana,
    diasActivos,
    constancia,
    maximoDia,
    materias,
    metaSemanal: 4,
    metaAlcanzada: diasActivos >= 4,
    historialLimitado: historial.length >= 100,
  };
}
