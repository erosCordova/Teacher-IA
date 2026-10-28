export type TemaAcademico = "fracciones" | "ecuaciones";

export type MateriaAcademica = {
  tema: string;
  intentos: number;
  correctos: number;
  porcentaje: number;
};

export type DatosAcademicos = {
  totalIntentos: number;
  totalAciertos: number;
  diasActivos: number;
  materias: MateriaAcademica[];
};

export type Logro = {
  id: string;
  nombre: string;
  descripcion: string;
  progreso: number;
  objetivo: number;
  desbloqueado: boolean;
  indicador: string;
};

export type Mision = {
  tema: TemaAcademico;
  titulo: string;
  descripcion: string;
};

function numeroSeguro(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function crearLogro(
  id: string,
  nombre: string,
  descripcion: string,
  progresoReal: number,
  objetivo: number,
  indicador: string,
): Logro {
  const progreso = Math.min(
    objetivo,
    numeroSeguro(progresoReal),
  );

  return {
    id,
    nombre,
    descripcion,
    progreso,
    objetivo,
    desbloqueado: progreso >= objetivo,
    indicador,
  };
}

export function calcularRetos(datos: DatosAcademicos) {
  const intentos = numeroSeguro(datos.totalIntentos);
  const aciertos = Math.min(
    intentos,
    numeroSeguro(datos.totalAciertos),
  );

  const dias = numeroSeguro(datos.diasActivos);

  const materias = (
    ["fracciones", "ecuaciones"] as TemaAcademico[]
  ).map((tema) => {
    const original = datos.materias.find(
      (item) => item.tema === tema,
    );

    const cantidad = numeroSeguro(
      original?.intentos ?? 0,
    );

    return {
      tema,
      intentos: cantidad,
      correctos: Math.min(
        cantidad,
        numeroSeguro(original?.correctos ?? 0),
      ),
      porcentaje: cantidad > 0
        ? Math.round(
            (
              Math.min(
                cantidad,
                numeroSeguro(original?.correctos ?? 0),
              ) / cantidad
            ) * 100,
          )
        : 0,
    };
  });

  const materiasExploradas = materias.filter(
    (materia) => materia.intentos > 0,
  ).length;

  const logros = [
    crearLogro(
      "primer-paso",
      "Primer paso",
      "Completa tu primer ejercicio.",
      intentos,
      1,
      "01",
    ),
    crearLogro(
      "cinco-aciertos",
      "Mente en marcha",
      "Consigue cinco respuestas correctas.",
      aciertos,
      5,
      "05",
    ),
    crearLogro(
      "diez-practicas",
      "Explorador del conocimiento",
      "Realiza diez ejercicios.",
      intentos,
      10,
      "10",
    ),
    crearLogro(
      "dos-materias",
      "Aprendiz versátil",
      "Practica fracciones y ecuaciones.",
      materiasExploradas,
      2,
      "02",
    ),
    crearLogro(
      "tres-dias",
      "Constancia semanal",
      "Practica durante tres días distintos de la última semana.",
      dias,
      3,
      "03",
    ),
    crearLogro(
      "veinticinco",
      "Gran perseverancia",
      "Completa veinticinco ejercicios.",
      intentos,
      25,
      "25",
    ),
  ];

  const completados = logros.filter(
    (logro) => logro.desbloqueado,
  ).length;

  let tema: TemaAcademico = "fracciones";
  let descripcion = "";

  const practicadas = materias.filter(
    (materia) => materia.intentos > 0,
  );

  if (practicadas.length === 0) {
    descripcion =
      "Comienza con una práctica guiada de fracciones.";
  } else {
    const errores = practicadas.filter(
      (materia) =>
        materia.correctos < materia.intentos,
    );

    if (errores.length > 0) {
      errores.sort(
        (a, b) =>
          a.porcentaje - b.porcentaje ||
          b.intentos - a.intentos,
      );

      tema = errores[0].tema;

      descripcion =
        "Esta materia presenta una mayor proporción " +
        "de respuestas por revisar. Repasa con pistas " +
        "y ejercicios adaptativos.";
    } else {
      const noPracticada = materias.find(
        (materia) => materia.intentos === 0,
      );

      if (noPracticada) {
        tema = noPracticada.tema;

        descripcion =
          "Explora una materia que todavía no has practicado.";
      } else {
        const menosPracticada = [...materias].sort(
          (a, b) =>
            a.intentos - b.intentos,
        )[0];

        tema = menosPracticada.tema;

        descripcion =
          "Continúa reforzando tus conocimientos " +
          "con nuevos ejercicios.";
      }
    }
  }

  const nombreTema =
    tema === "fracciones"
      ? "Fracciones"
      : "Ecuaciones";

  return {
    logros,
    completados,
    total: logros.length,
    mision: {
      tema,
      titulo: `Practicar ${nombreTema}`,
      descripcion,
    } satisfies Mision,
  };
}
