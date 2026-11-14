# Estado del aporte de Laura

Las anotaciones del enunciado asignan a Laura la autenticación con hashing y salt y las pantallas de progreso y marcas personales. El informe consolidado y el video se asignan a Sofía; la implementación web general, a Gabi. Este archivo distingue lo implementado de lo pendiente para integrar el trabajo del equipo.

| Punto | Estado verificable |
| --- | --- |
| Hashing y salt en registro y login | Implementado con Argon2id en el servidor. |
| Migración de usuarios existentes | Comando implementado, probado con MySQL y datos ficticios; debe ejecutarse en cada base existente. |
| Repetición y fallo de la migración | Probados: conserva los hashes existentes y revierte todas las actualizaciones ante un fallo. |
| Creación de cuentas de demostración | Ambos comandos crean hashes y conservan las cuentas al repetirse. |
| Soporte para el informe | Fragmento LaTeX y bibliografía preparados para integrar al informe consolidado. |
| Pantallas de progreso y marcas personales | Pendientes: no se han implementado ni contrastado con el prototipo. |
| Datos de progreso y marcas personales | Pendientes: la API actual de cinco tablas no almacena estos recursos. |

## Criterios de la rúbrica

| Criterio | Máximo | Evidencia o trabajo restante |
| --- | ---: | --- |
| Implementación del frontend | 15 | Falta implementar y revisar las pantallas y sus estados contra Figma. |
| Integración funcional con la API | 25 | La API existente está probada; falta consumir datos reales desde las pantallas asignadas. No se añadieron datos simulados a una interfaz. |
| Autenticación segura | 20 | Código de registro y login, migración y pruebas. La documentación argumenta WebAuthn como mejora pendiente. La migración de la instalación entregada debe verificarse también allí. |
| Redacción e hilo argumental | 20 | El aporte explica el cambio respecto al corte 2 y su limitación. Sofía debe integrarlo con el resto del producto y las conclusiones. |
| Rigor IEEE | 5 | Fragmento y referencias para la integración; debe comprobarse el PDF consolidado una vez compilado en su plantilla IEEE. |
| Seguimiento de instrucciones | 15 | Faltan la integración web completa, la revisión del informe y el enlace accesible al video funcional de máximo cinco minutos. |

Los máximos no son una calificación obtenida. La evaluación depende de la entrega completa y de las instrucciones dadas en clase que no estén incluidas en los PDF.

## Penalizaciones revisadas en este cambio

Se usaron identificadores en inglés y funciones separadas para hashing, verificación, acceso a datos y migración. La política de hashing está en un archivo de configuración. Las rutas públicas continúan nombrando recursos, las entradas conservan sus validaciones y los errores se procesan sin imprimir credenciales. No se agregaron emojis, comentarios de relleno ni librerías sin utilizar. Los nombres de variables y alias de los scripts SQL heredados se ajustaron al inglés; los nombres de archivo elegidos por el equipo se conservan.

El código permanece en la raíz del repositorio. La autenticación y su documentación se presentan en commits separados con mensajes que explican el cambio. Esta revisión no certifica ausencia de todas las penalizaciones del proyecto completo: la interfaz y los entregables de las otras integrantes aún necesitan su propia validación.

## Material para el informe

`laura-authentication.tex` contiene subsecciones para incorporar al documento del equipo, no un informe independiente. Sus claves bibliográficas están en `references.bib`. Para integrarlas, añadir el fragmento mediante `\input` y combinar esas entradas con la bibliografía del informe, conservando el estilo IEEE de su plantilla. No debe presentarse la migración de una base de pruebas como si ya se hubiera ejecutado en la base local de entrega.
