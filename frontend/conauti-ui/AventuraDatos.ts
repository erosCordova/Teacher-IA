/** Banco inicial verificado de actividades para 1.º a 5.º de secundaria.
 * Sin preguntas generadas automáticamente: respuestas deterministas y explicadas.
 */
export type MateriaId =
  | 'biologia' | 'matematicas' | 'ingles' | 'comunicacion' | 'peru'
  | 'universal' | 'cultura' | 'fisica' | 'quimica' | 'geografia'
  | 'tecnologia' | 'ciudadania' | 'arte' | 'ambiente';
export type Materia = {
  id: MateriaId; titulo: string; icono: string; color: string; descripcion: string;
};
export const MATERIAS: Materia[] = [
  {id:'biologia',titulo:'Biología y ciencias',icono:'🧬',color:'#16b89e',descripcion:'Células, anatomía y seres vivos'},
  {id:'matematicas',titulo:'Matemáticas',icono:'📐',color:'#4a86f7',descripcion:'Números, geometría y lógica'},
  {id:'ingles',titulo:'Inglés',icono:'🌍',color:'#925ce9',descripcion:'Vocabulary, listening y gramática'},
  {id:'comunicacion',titulo:'Comunicación',icono:'📚',color:'#10b8bb',descripcion:'Lectura, escritura y lenguaje'},
  {id:'peru',titulo:'Historia del Perú',icono:'🇵🇪',color:'#ff8067',descripcion:'Culturas y personajes peruanos'},
  {id:'universal',titulo:'Historia universal',icono:'🏛️',color:'#f3a749',descripcion:'Civilizaciones y épocas'},
  {id:'cultura',titulo:'Cultura general',icono:'💡',color:'#f3bc45',descripcion:'Descubrimientos y curiosidades'},
  {id:'fisica',titulo:'Física',icono:'⚡',color:'#6178f5',descripcion:'Movimiento, energía y fuerzas'},
  {id:'quimica',titulo:'Química',icono:'⚗️',color:'#c96cdb',descripcion:'Átomos y transformaciones'},
  {id:'geografia',titulo:'Geografía',icono:'🗺️',color:'#18af9c',descripcion:'Mapas, regiones y continentes'},
  {id:'tecnologia',titulo:'Tecnología',icono:'💻',color:'#4685ff',descripcion:'Computación y pensamiento lógico'},
  {id:'ciudadania',titulo:'Ciudadanía',icono:'🤝',color:'#ed8d66',descripcion:'Convivencia y derechos'},
  {id:'arte',titulo:'Arte y cultura',icono:'🎨',color:'#ea73a9',descripcion:'Expresión y creatividad'},
  {id:'ambiente',titulo:'Medio ambiente',icono:'🌿',color:'#45b979',descripcion:'Ecosistemas y sostenibilidad'},
];
export type Pregunta = {
  id:string; materia:MateriaId; nivel:1|2|3; titulo:string;
  opciones:[string,string,string,string]; respuesta:number; explicacion:string;
};
export const PREGUNTAS: Pregunta[] = [
  {id:'bio1',materia:'biologia',nivel:1,titulo:'¿Qué órgano bombea la sangre por todo el cuerpo?',opciones:['Pulmones','Corazón','Estómago','Hígado'],respuesta:1,explicacion:'El corazón impulsa la sangre a través de los vasos sanguíneos.'},
  {id:'bio2',materia:'biologia',nivel:2,titulo:'¿En qué parte de una célula eucariota se encuentra la mayor parte del ADN?',opciones:['Membrana','Citoplasma','Núcleo','Ribosoma'],respuesta:2,explicacion:'El núcleo contiene la mayor parte del material genético de la célula eucariota.'},
  {id:'bio3',materia:'biologia',nivel:3,titulo:'¿Qué proceso transforma luz en energía química en las plantas?',opciones:['Fermentación','Fotosíntesis','Digestión','Transpiración'],respuesta:1,explicacion:'Durante la fotosíntesis, las plantas utilizan energía luminosa para producir compuestos orgánicos.'},
  {id:'mat1',materia:'matematicas',nivel:1,titulo:'¿Cuánto es 3/4 + 1/4?',opciones:['1/2','4/8','1','2'],respuesta:2,explicacion:'Como el denominador es el mismo, sumamos numeradores: 4/4 = 1.'},
  {id:'mat2',materia:'matematicas',nivel:2,titulo:'Si 3x + 2 = 17, ¿cuál es el valor de x?',opciones:['3','5','6','7'],respuesta:1,explicacion:'Al restar 2 queda 3x = 15; al dividir entre 3, x = 5.'},
  {id:'mat3',materia:'matematicas',nivel:3,titulo:'¿Cuál es la pendiente de y = −2x + 7?',opciones:['7','2','−2','−7'],respuesta:2,explicacion:'En y = mx + b, m es la pendiente: en este caso, −2.'},
  {id:'eng1',materia:'ingles',nivel:1,titulo:'Choose the correct translation of «apple».',opciones:['Mesa','Manzana','Puerta','Árbol'],respuesta:1,explicacion:'Apple significa manzana. Puedes practicar su pronunciación en voz alta.'},
  {id:'eng2',materia:'ingles',nivel:2,titulo:'Complete: «She ___ to school every day».',opciones:['go','going','goes','gone'],respuesta:2,explicacion:'En presente simple, con he/she/it usamos la terminación -s o -es: goes.'},
  {id:'eng3',materia:'ingles',nivel:3,titulo:'Which sentence uses the past perfect correctly?',opciones:['I had finished before noon.','I have finish yesterday.','I has finished before.','I had finish now.'],respuesta:0,explicacion:'El pasado perfecto se forma con had + participio: had finished.'},
  {id:'com1',materia:'comunicacion',nivel:1,titulo:'¿Cuál de estas palabras es un sustantivo?',opciones:['Rápido','Escribir','Biblioteca','Muy'],respuesta:2,explicacion:'Biblioteca es el nombre de un lugar; por eso es un sustantivo.'},
  {id:'com2',materia:'comunicacion',nivel:2,titulo:'¿Qué signo cierra una pregunta directa en español?',opciones:['¡','¿','?',';'],respuesta:2,explicacion:'Las preguntas directas se escriben con signos de apertura ¿ y cierre ?.'},
  {id:'com3',materia:'comunicacion',nivel:3,titulo:'¿Qué recurso consiste en comparar usando «como»?',opciones:['Metáfora','Hipérbole','Símil','Anáfora'],respuesta:2,explicacion:'El símil establece semejanzas de forma explícita: «brilla como el sol».'},
  {id:'per1',materia:'peru',nivel:1,titulo:'¿Cuál fue la capital del Imperio inca?',opciones:['Lima','Cusco','Puno','Arequipa'],respuesta:1,explicacion:'Cusco fue el centro político y religioso del Tahuantinsuyo.'},
  {id:'per2',materia:'peru',nivel:2,titulo:'¿En qué año se proclamó la independencia del Perú?',opciones:['1821','1824','1810','1879'],respuesta:0,explicacion:'José de San Martín proclamó la independencia del Perú el 28 de julio de 1821.'},
  {id:'per3',materia:'peru',nivel:3,titulo:'¿En qué batalla de 1824 se consolidó la independencia del Perú?',opciones:['Arica','Ayacucho','Junín de 1880','Tarapacá'],respuesta:1,explicacion:'La batalla de Ayacucho, en diciembre de 1824, fue decisiva para la independencia sudamericana.'},
  {id:'his1',materia:'universal',nivel:1,titulo:'¿En qué continente se desarrolló el antiguo Egipto?',opciones:['Europa','Asia','África','Oceanía'],respuesta:2,explicacion:'La civilización del antiguo Egipto se desarrolló en el noreste de África.'},
  {id:'his2',materia:'universal',nivel:2,titulo:'¿En qué siglo comenzó la Revolución francesa?',opciones:['XVI','XVII','XVIII','XIX'],respuesta:2,explicacion:'La Revolución francesa comenzó en 1789, durante el siglo XVIII.'},
  {id:'his3',materia:'universal',nivel:3,titulo:'¿En qué año cayó Constantinopla ante los otomanos?',opciones:['1453','1492','1517','1204'],respuesta:0,explicacion:'Constantinopla cayó en 1453, un acontecimiento fundamental para la historia europea y otomana.'},
  {id:'cul1',materia:'cultura',nivel:1,titulo:'¿Cuál es el planeta más cercano al Sol?',opciones:['Venus','Mercurio','Marte','Tierra'],respuesta:1,explicacion:'Mercurio es el planeta más cercano al Sol.'},
  {id:'cul2',materia:'cultura',nivel:2,titulo:'¿Qué instrumento permite observar objetos celestes lejanos?',opciones:['Termómetro','Telescopio','Microscopio','Barómetro'],respuesta:1,explicacion:'El telescopio capta y concentra luz de objetos astronómicos.'},
  {id:'cul3',materia:'cultura',nivel:3,titulo:'¿Cuál de estos números es primo?',opciones:['21','27','29','33'],respuesta:2,explicacion:'29 solo tiene como divisores positivos a 1 y 29.'},
  {id:'fis1',materia:'fisica',nivel:1,titulo:'¿Qué unidad se usa para medir la fuerza en el SI?',opciones:['Joule','Newton','Watt','Metro'],respuesta:1,explicacion:'La fuerza se mide en newtons (N).'},
  {id:'fis2',materia:'fisica',nivel:2,titulo:'¿Qué magnitud se calcula como distancia dividida entre tiempo?',opciones:['Masa','Rapidez media','Densidad','Potencia'],respuesta:1,explicacion:'Rapidez media = distancia recorrida / tiempo empleado.'},
  {id:'fis3',materia:'fisica',nivel:3,titulo:'¿Qué sucede con la corriente si se duplica la resistencia a voltaje constante?',opciones:['Se duplica','No cambia','Se reduce a la mitad','Se cuadruplica'],respuesta:2,explicacion:'Por la ley de Ohm (I = V/R), si R se duplica, I se reduce a la mitad.'},
  {id:'qui1',materia:'quimica',nivel:1,titulo:'¿Cuál es el símbolo químico del oxígeno?',opciones:['Ox','O','Og','H'],respuesta:1,explicacion:'O es el símbolo del elemento oxígeno.'},
  {id:'qui2',materia:'quimica',nivel:2,titulo:'¿Qué partículas tienen carga negativa?',opciones:['Protones','Neutrones','Electrones','Núcleos'],respuesta:2,explicacion:'Los electrones tienen carga eléctrica negativa.'},
  {id:'qui3',materia:'quimica',nivel:3,titulo:'¿Qué pH corresponde a una disolución ácida a 25 °C?',opciones:['Mayor que 7','Igual a 7','Menor que 7','Siempre 14'],respuesta:2,explicacion:'En condiciones habituales a 25 °C, una disolución ácida presenta pH menor que 7.'},
  {id:'geo1',materia:'geografia',nivel:1,titulo:'¿Qué océano baña la costa occidental del Perú?',opciones:['Atlántico','Índico','Pacífico','Ártico'],respuesta:2,explicacion:'La costa peruana se encuentra junto al océano Pacífico.'},
  {id:'geo2',materia:'geografia',nivel:2,titulo:'¿Qué cordillera recorre gran parte del territorio peruano?',opciones:['Alpes','Andes','Himalaya','Rocosas'],respuesta:1,explicacion:'La cordillera de los Andes atraviesa el Perú de norte a sur.'},
  {id:'geo3',materia:'geografia',nivel:3,titulo:'¿Qué líneas imaginarias indican la latitud?',opciones:['Meridianos','Paralelos','Husos horarios','Isobaras'],respuesta:1,explicacion:'Los paralelos permiten determinar la latitud al norte o sur del ecuador.'},
  {id:'tec1',materia:'tecnologia',nivel:1,titulo:'¿Qué componente ejecuta instrucciones de los programas?',opciones:['Monitor','Procesador','Ratón','Impresora'],respuesta:1,explicacion:'La CPU o procesador ejecuta instrucciones y operaciones.'},
  {id:'tec2',materia:'tecnologia',nivel:2,titulo:'¿Qué estructura repite instrucciones mientras se cumpla una condición?',opciones:['Bucle','Variable','Comentario','Archivo'],respuesta:0,explicacion:'Un bucle repite instrucciones de acuerdo con una condición o un número de iteraciones.'},
  {id:'tec3',materia:'tecnologia',nivel:3,titulo:'¿Qué técnica divide datos en entrenamiento y prueba?',opciones:['Compresión','Partición de datos','Cifrado','Recursión'],respuesta:1,explicacion:'La partición permite evaluar un modelo con datos no usados al entrenarlo.'},
  {id:'ciu1',materia:'ciudadania',nivel:1,titulo:'¿Qué acción muestra respeto durante un debate?',opciones:['Interrumpir','Escuchar argumentos','Burlarse','Imponer ideas'],respuesta:1,explicacion:'Escuchar y considerar otras opiniones ayuda al diálogo respetuoso.'},
  {id:'ciu2',materia:'ciudadania',nivel:2,titulo:'¿Cuál es una función principal de las normas de convivencia?',opciones:['Evitar toda opinión','Proteger la convivencia','Eliminar desacuerdos','Castigar siempre'],respuesta:1,explicacion:'Las normas facilitan respeto, seguridad y resolución pacífica de conflictos.'},
  {id:'ciu3',materia:'ciudadania',nivel:3,titulo:'¿Qué concepto significa que todas las personas tienen igual dignidad?',opciones:['Exclusión','Igualdad de derechos','Privilegio','Censura'],respuesta:1,explicacion:'La igualdad de derechos reconoce la misma dignidad para todas las personas.'},
  {id:'art1',materia:'arte',nivel:1,titulo:'¿Qué colores se obtienen al mezclar pigmentos azul y amarillo?',opciones:['Rojo','Verde','Morado','Blanco'],respuesta:1,explicacion:'En la mezcla tradicional de pigmentos, azul y amarillo producen verde.'},
  {id:'art2',materia:'arte',nivel:2,titulo:'¿Qué expresión artística utiliza movimientos corporales rítmicos?',opciones:['Escultura','Danza','Arquitectura','Grabado'],respuesta:1,explicacion:'La danza expresa ideas y emociones mediante movimientos.'},
  {id:'art3',materia:'arte',nivel:3,titulo:'¿Qué técnica organiza objetos cercanos y lejanos para dar profundidad?',opciones:['Perspectiva','Rima','Contrapunto','Saturación'],respuesta:0,explicacion:'La perspectiva ayuda a representar profundidad sobre superficies planas.'},
  {id:'amb1',materia:'ambiente',nivel:1,titulo:'¿Cuál de estas acciones reduce residuos?',opciones:['Desechar todo','Reutilizar envases','Quemar plástico','Comprar descartables'],respuesta:1,explicacion:'Reutilizar productos alarga su vida útil y reduce residuos.'},
  {id:'amb2',materia:'ambiente',nivel:2,titulo:'¿Qué organismos producen su alimento mediante fotosíntesis?',opciones:['Hongos','Muchas plantas','Mamíferos','Insectos'],respuesta:1,explicacion:'Muchas plantas elaboran materia orgánica a partir de luz, agua y CO₂.'},
  {id:'amb3',materia:'ambiente',nivel:3,titulo:'¿Qué gas de efecto invernadero emite la combustión de combustibles fósiles?',opciones:['Helio','Dióxido de carbono','Neón','Argón'],respuesta:1,explicacion:'La combustión libera CO₂, un gas de efecto invernadero.'},
];
export type Pieza = {id:string;nombre:string;descripcion:string;x:number;y:number;forma:string};
export type Rompecabezas = {id:string;materia:MateriaId;nombre:string;subtitulo:string;tipo:'cuerpo'|'celula'|'sistema'|'mapa'|'diagrama';piezas:Pieza[]};
export const ROMPECABEZAS: Rompecabezas[] = [
  {id:'anatomia',materia:'biologia',nombre:'Arma el cuerpo humano',subtitulo:'Coloca los órganos en su posición aproximada.',tipo:'cuerpo',piezas:[
    {id:'cerebro',nombre:'Cerebro',descripcion:'Coordina el pensamiento, los movimientos y otras funciones del cuerpo.',x:50,y:19,forma:'🧠'},
    {id:'pulmones',nombre:'Pulmones',descripcion:'Permiten intercambiar oxígeno y dióxido de carbono.',x:38,y:41,forma:'🫁'},
    {id:'corazon',nombre:'Corazón',descripcion:'Bombea sangre por el sistema circulatorio.',x:62,y:41,forma:'❤️'},
    {id:'higado',nombre:'Hígado',descripcion:'Procesa nutrientes y ayuda a eliminar sustancias.',x:38,y:57,forma:'🟤'},
    {id:'estomago',nombre:'Estómago',descripcion:'Mezcla los alimentos con los jugos gástricos.',x:62,y:57,forma:'🫙'},
    {id:'intestinos',nombre:'Intestinos',descripcion:'Participan en la absorción de nutrientes y agua.',x:50,y:74,forma:'🌀'},
  ]},
  {id:'celula',materia:'biologia',nombre:'Construye una célula',subtitulo:'Ubica los componentes de una célula animal.',tipo:'celula',piezas:[
    {id:'membrana',nombre:'Membrana plasmática',descripcion:'Delimita la célula y regula el intercambio de sustancias.',x:17,y:50,forma:'🟢'},
    {id:'nucleo',nombre:'Núcleo',descripcion:'Alberga la mayor parte del ADN.',x:50,y:47,forma:'🟣'},
    {id:'mitocondria',nombre:'Mitocondria',descripcion:'Participa en la obtención de energía de la célula.',x:70,y:67,forma:'🟠'},
    {id:'ribosoma',nombre:'Ribosomas',descripcion:'Intervienen en la síntesis de proteínas.',x:71,y:30,forma:'🔵'},
  ]},
  {id:'solar',materia:'cultura',nombre:'Construye el sistema solar',subtitulo:'Ubica los planetas interiores según su distancia al Sol.',tipo:'sistema',piezas:[
    {id:'mercurio',nombre:'Mercurio',descripcion:'Es el planeta más cercano al Sol.',x:24,y:50,forma:'🪨'},
    {id:'venus',nombre:'Venus',descripcion:'Es el segundo planeta desde el Sol.',x:43,y:50,forma:'🟠'},
    {id:'tierra',nombre:'Tierra',descripcion:'Es el tercer planeta desde el Sol.',x:63,y:50,forma:'🌎'},
    {id:'marte',nombre:'Marte',descripcion:'Es el cuarto planeta desde el Sol.',x:83,y:50,forma:'🔴'},
  ]},
  {id:'oracion',materia:'ingles',nombre:'Build a sentence',subtitulo:'Ordena una oración en presente simple.',tipo:'diagrama',piezas:[
    {id:'she',nombre:'She',descripcion:'She: pronombre personal de tercera persona.',x:17,y:51,forma:'👩'},
    {id:'reads',nombre:'reads',descripcion:'Reads: verbo read en tercera persona.',x:39,y:51,forma:'📖'},
    {id:'a',nombre:'a',descripcion:'A: artículo indefinido.',x:61,y:51,forma:'🔤'},
    {id:'book',nombre:'book',descripcion:'Book: libro.',x:82,y:51,forma:'📚'},
  ]},
  {id:'fraccion',materia:'matematicas',nombre:'Construye una fracción',subtitulo:'Identifica las partes de la expresión 3/4.',tipo:'diagrama',piezas:[
    {id:'num',nombre:'Numerador: 3',descripcion:'El numerador indica cuántas partes se toman.',x:36,y:35,forma:'3️⃣'},
    {id:'den',nombre:'Denominador: 4',descripcion:'El denominador indica en cuántas partes iguales se divide la unidad.',x:36,y:66,forma:'4️⃣'},
    {id:'unidad',nombre:'Unidad',descripcion:'La unidad representa el todo que dividimos.',x:76,y:52,forma:'🟨'},
  ]},
  {id:'narrativa',materia:'comunicacion',nombre:'Arma una narración',subtitulo:'Ordena los momentos de una historia.',tipo:'diagrama',piezas:[
    {id:'inicio',nombre:'Inicio',descripcion:'Presenta personajes, lugar y situación inicial.',x:19,y:52,forma:'📖'},
    {id:'nudo',nombre:'Nudo',descripcion:'Desarrolla el problema o conflicto.',x:50,y:52,forma:'🧩'},
    {id:'desenlace',nombre:'Desenlace',descripcion:'Muestra cómo concluye la historia.',x:81,y:52,forma:'🏁'},
  ]},
  {id:'cronoperu',materia:'peru',nombre:'Línea de tiempo del Perú',subtitulo:'Coloca los hitos de la independencia en orden.',tipo:'diagrama',piezas:[
    {id:'1814',nombre:'Rebelión del Cusco (1814)',descripcion:'Levantamiento encabezado por los hermanos Angulo y Pumacahua.',x:20,y:52,forma:'🗞️'},
    {id:'1821',nombre:'Proclamación (1821)',descripcion:'San Martín proclamó la independencia en Lima.',x:50,y:52,forma:'🇵🇪'},
    {id:'1824',nombre:'Ayacucho (1824)',descripcion:'La batalla consolidó el proceso de independencia.',x:80,y:52,forma:'🏅'},
  ]},
  {id:'mundo',materia:'universal',nombre:'Historia en orden',subtitulo:'Organiza tres acontecimientos históricos.',tipo:'diagrama',piezas:[
    {id:'roma',nombre:'Caída de Roma occidental (476)',descripcion:'La caída del poder imperial de Occidente ocurrió en 476.',x:20,y:52,forma:'🏛️'},
    {id:'constantinopla',nombre:'Caída de Constantinopla (1453)',descripcion:'Los otomanos conquistaron Constantinopla.',x:50,y:52,forma:'🏰'},
    {id:'francia',nombre:'Revolución francesa (1789)',descripcion:'Transformó profundamente la política francesa y europea.',x:80,y:52,forma:'⚖️'},
  ]},
  {id:'circuito',materia:'fisica',nombre:'Completa el circuito',subtitulo:'Identifica componentes de un circuito eléctrico simple.',tipo:'diagrama',piezas:[
    {id:'bateria',nombre:'Batería',descripcion:'Proporciona la diferencia de potencial.',x:18,y:50,forma:'🔋'},
    {id:'cable',nombre:'Conductor',descripcion:'Permite circular corriente por el circuito.',x:50,y:50,forma:'➰'},
    {id:'bombilla',nombre:'Bombilla',descripcion:'Convierte energía eléctrica en luz y calor.',x:82,y:50,forma:'💡'},
  ]},
  {id:'atomo',materia:'quimica',nombre:'Construye un átomo',subtitulo:'Identifica tres partículas subatómicas.',tipo:'celula',piezas:[
    {id:'proton',nombre:'Protón',descripcion:'Tiene carga eléctrica positiva.',x:46,y:48,forma:'🔴'},
    {id:'neutron',nombre:'Neutrón',descripcion:'Tiene carga eléctrica neutra.',x:57,y:53,forma:'⚪'},
    {id:'electron',nombre:'Electrón',descripcion:'Tiene carga eléctrica negativa.',x:79,y:22,forma:'🔵'},
  ]},
  {id:'respiracion',materia:'biologia',nombre:'El viaje del oxígeno',subtitulo:'Ordena etapas simplificadas de la respiración.',tipo:'diagrama',piezas:[
    {id:'inspirar',nombre:'Inspiración',descripcion:'El aire entra por las vías respiratorias.',x:19,y:52,forma:'👃'},
    {id:'pulmones',nombre:'Intercambio gaseoso',descripcion:'En los alvéolos se intercambian oxígeno y dióxido de carbono.',x:50,y:52,forma:'🫁'},
    {id:'sangre',nombre:'Transporte de oxígeno',descripcion:'La sangre transporta oxígeno a los tejidos.',x:81,y:52,forma:'🩸'},
  ]},
  {id:'reaccion',materia:'quimica',nombre:'Etapas de una reacción',subtitulo:'Ordena un esquema científico sencillo.',tipo:'diagrama',piezas:[
    {id:'reactivos',nombre:'Reactivos',descripcion:'Son las sustancias presentes antes de la reacción.',x:19,y:52,forma:'🧪'},
    {id:'cambio',nombre:'Transformación',descripcion:'Durante la reacción se reorganizan átomos y enlaces.',x:50,y:52,forma:'⚗️'},
    {id:'productos',nombre:'Productos',descripcion:'Son las sustancias resultantes de la reacción.',x:81,y:52,forma:'🔬'},
  ]},
  {id:'investigacion',materia:'cultura',nombre:'Cómo investigar',subtitulo:'Organiza los pasos iniciales del pensamiento científico.',tipo:'diagrama',piezas:[
    {id:'preguntar',nombre:'Hacer preguntas',descripcion:'Plantea una duda sobre lo que observas.',x:19,y:52,forma:'❓'},
    {id:'investigar',nombre:'Investigar',descripcion:'Recoge información y comprueba evidencias.',x:50,y:52,forma:'🔍'},
    {id:'explicar',nombre:'Explicar',descripcion:'Comunica una conclusión basada en los datos.',x:81,y:52,forma:'💡'},
  ]},
  {id:'regiones',materia:'geografia',nombre:'Las regiones naturales del Perú',subtitulo:'Organiza costa, sierra y selva de oeste a este (esquema simplificado).',tipo:'diagrama',piezas:[
    {id:'costa',nombre:'Costa',descripcion:'Zona próxima al océano Pacífico, con extensas áreas desérticas.',x:20,y:52,forma:'🌊'},
    {id:'sierra',nombre:'Sierra',descripcion:'Región andina de montañas, valles y altiplanos.',x:50,y:52,forma:'🏔️'},
    {id:'selva',nombre:'Selva',descripcion:'Región amazónica de bosques tropicales.',x:80,y:52,forma:'🌿'},
  ]},
  {id:'computador',materia:'tecnologia',nombre:'Arma una computadora',subtitulo:'Relaciona los componentes con un esquema funcional simplificado.',tipo:'diagrama',piezas:[
    {id:'entrada',nombre:'Dispositivo de entrada',descripcion:'Permite ingresar datos, como el teclado.',x:19,y:52,forma:'⌨️'},
    {id:'cpu',nombre:'Procesador',descripcion:'Procesa instrucciones y operaciones.',x:50,y:52,forma:'💻'},
    {id:'salida',nombre:'Dispositivo de salida',descripcion:'Muestra resultados, como el monitor.',x:81,y:52,forma:'🖥️'},
  ]},
  {id:'convivencia',materia:'ciudadania',nombre:'Construye un buen diálogo',subtitulo:'Ordena pasos para resolver un desacuerdo de forma respetuosa.',tipo:'diagrama',piezas:[
    {id:'escuchar',nombre:'Escuchar',descripcion:'Presta atención a los argumentos sin interrumpir.',x:19,y:52,forma:'👂'},
    {id:'expresar',nombre:'Expresarse',descripcion:'Comunica tu opinión de manera clara y respetuosa.',x:50,y:52,forma:'💬'},
    {id:'acordar',nombre:'Llegar a acuerdos',descripcion:'Busca soluciones que consideren a las personas implicadas.',x:81,y:52,forma:'🤝'},
  ]},
  {id:'artes',materia:'arte',nombre:'Construye una obra',subtitulo:'Organiza etapas habituales de un proyecto artístico.',tipo:'diagrama',piezas:[
    {id:'idea',nombre:'Idea',descripcion:'Piensa qué deseas expresar.',x:19,y:52,forma:'💡'},
    {id:'boceto',nombre:'Boceto',descripcion:'Planifica la composición mediante un dibujo previo.',x:50,y:52,forma:'✏️'},
    {id:'obra',nombre:'Obra final',descripcion:'Elabora tu creación aplicando materiales y técnicas.',x:81,y:52,forma:'🎨'},
  ]},
  {id:'agua',materia:'ambiente',nombre:'Arma el ciclo del agua',subtitulo:'Ordena etapas principales del ciclo del agua.',tipo:'diagrama',piezas:[
    {id:'evaporacion',nombre:'Evaporación',descripcion:'El agua líquida pasa a vapor por efecto de la energía térmica.',x:19,y:52,forma:'☀️'},
    {id:'condensacion',nombre:'Condensación',descripcion:'El vapor se enfría y forma pequeñas gotas que pueden constituir nubes.',x:50,y:52,forma:'☁️'},
    {id:'precipitacion',nombre:'Precipitación',descripcion:'El agua regresa a la superficie en forma de lluvia, nieve u otras precipitaciones.',x:81,y:52,forma:'🌧️'},
  ]},
];
export type Curiosidad={id:string;materia:MateriaId;titulo:string;dato:string;pregunta:string;respuesta:string;ilustracion:string};
export const CURIOSIDADES:Curiosidad[]=[
  {id:'venus',materia:'cultura',titulo:'¿Un día más largo que un año?',dato:'Venus tarda aproximadamente 243 días terrestres en dar una vuelta sobre su eje y unos 225 días en orbitar el Sol.',pregunta:'¿Qué dura más en Venus: una rotación o una órbita?',respuesta:'Una rotación sobre su eje.',ilustracion:'🪐'},
  {id:'pulpo',materia:'biologia',titulo:'Tres corazones bajo el mar',dato:'Los pulpos tienen tres corazones: dos bombean sangre a las branquias y uno al resto del cuerpo.',pregunta:'¿Cuántos corazones tiene un pulpo?',respuesta:'Tres.',ilustracion:'🐙'},
  {id:'inca',materia:'peru',titulo:'Mensajes sin escritura alfabética',dato:'Los incas utilizaron quipus, conjuntos de cuerdas y nudos para registrar información, especialmente contable.',pregunta:'¿Cómo se llaman los conjuntos de cuerdas con nudos utilizados por los incas?',respuesta:'Quipus.',ilustracion:'🇵🇪'},
  {id:'pi',materia:'matematicas',titulo:'Un número que nunca termina',dato:'π es un número irracional: su expansión decimal no termina ni tiene un período repetitivo.',pregunta:'¿La expansión decimal de π termina?',respuesta:'No, es infinita y no periódica.',ilustracion:'π'},
  {id:'ingles',materia:'ingles',titulo:'Una palabra con dos sentidos',dato:'En inglés, «light» puede significar «luz», «ligero» o «claro», según el contexto.',pregunta:'¿Qué significa «light» en «a light bag»?',respuesta:'Ligera.',ilustracion:'💬'},
  {id:'donquijote',materia:'comunicacion',titulo:'La novela de los molinos',dato:'La primera parte de Don Quijote de la Mancha, de Miguel de Cervantes, se publicó en 1605.',pregunta:'¿Quién escribió Don Quijote de la Mancha?',respuesta:'Miguel de Cervantes.',ilustracion:'📖'},
  {id:'egipto',materia:'universal',titulo:'Pirámides milenarias',dato:'La Gran Pirámide de Guiza fue construida hace unos 4 500 años como monumento funerario del faraón Jufu (Keops).',pregunta:'¿En qué país se encuentra Guiza?',respuesta:'Egipto.',ilustracion:'🏜️'},
  {id:'rayo',materia:'fisica',titulo:'Vemos antes de oír',dato:'La luz viaja muchísimo más rápido que el sonido, por eso normalmente vemos el relámpago antes de escuchar el trueno.',pregunta:'¿Qué viaja más rápido, la luz o el sonido?',respuesta:'La luz.',ilustracion:'⚡'},
  {id:'agua',materia:'quimica',titulo:'Dos átomos y uno',dato:'Cada molécula de agua está formada por dos átomos de hidrógeno y uno de oxígeno: H₂O.',pregunta:'¿Qué representa el 2 en H₂O?',respuesta:'Dos átomos de hidrógeno.',ilustracion:'💧'},
  {id:'andes',materia:'geografia',titulo:'Una cordillera gigantesca',dato:'Los Andes forman una de las cadenas montañosas continentales más largas del mundo y atraviesan varios países sudamericanos.',pregunta:'¿Qué cordillera atraviesa el Perú?',respuesta:'Los Andes.',ilustracion:'🏔️'},
  {id:'algoritmo',materia:'tecnologia',titulo:'Las recetas son algoritmos',dato:'Una receta de cocina puede verse como una secuencia de pasos, igual que un algoritmo: recibe ingredientes y sigue instrucciones.',pregunta:'¿Qué es un algoritmo?',respuesta:'Una secuencia ordenada de pasos para resolver un problema.',ilustracion:'💻'},
  {id:'derechos',materia:'ciudadania',titulo:'La infancia tiene derechos',dato:'La Convención sobre los Derechos del Niño fue adoptada por la ONU en 1989.',pregunta:'¿En qué año se adoptó la Convención sobre los Derechos del Niño?',respuesta:'1989.',ilustracion:'🤝'},
  {id:'color',materia:'arte',titulo:'Colores que crean otros colores',dato:'En la pintura tradicional, la mezcla de pigmentos azul y amarillo suele producir verde.',pregunta:'¿Qué color se obtiene normalmente mezclando pigmentos azul y amarillo?',respuesta:'Verde.',ilustracion:'🎨'},
  {id:'arboles',materia:'ambiente',titulo:'Las plantas capturan carbono',dato:'Durante la fotosíntesis, las plantas incorporan dióxido de carbono del aire para producir compuestos orgánicos.',pregunta:'¿Qué gas incorporan las plantas para la fotosíntesis?',respuesta:'Dióxido de carbono.',ilustracion:'🌿'},
];
export const JUEGOS=[
 {id:'rompecabezas',nombre:'Arma y descubre',subtitulo:'Arrastra órganos, piezas y conceptos a su lugar.',icono:'🧩',color:'#16b89e',imagen:'cuerpo'},
 {id:'quiz',nombre:'Reto relámpago',subtitulo:'Preguntas rápidas por materia y dificultad.',icono:'⚡',color:'#517dfa',imagen:'rayos'},
 {id:'memoria',nombre:'Memoria inteligente',subtitulo:'Encuentra parejas de conceptos y definiciones.',icono:'🧠',color:'#965fe8',imagen:'memoria'},
 {id:'error',nombre:'Detective del error',subtitulo:'Descubre por qué una respuesta es incorrecta.',icono:'🔍',color:'#f17c6c',imagen:'detective'},
 {id:'orden',nombre:'Ordena la solución',subtitulo:'Reconstruye procesos, historias y oraciones.',icono:'🔢',color:'#00aebb',imagen:'orden'},
 {id:'mision',nombre:'Misión del conocimiento',subtitulo:'Supera niveles para desbloquear tu aventura.',icono:'🚀',color:'#efac3c',imagen:'mision'},
 {id:'ingles',nombre:'English Challenge',subtitulo:'Escucha, relaciona y aprende vocabulario.',icono:'🇬🇧',color:'#9364e8',imagen:'ingles'},
 {id:'mapa',nombre:'Explorador del mundo',subtitulo:'Viaja por la historia, el Perú y la geografía.',icono:'🗺️',color:'#2aab96',imagen:'mapa'},
] as const;
