# FitPulse: API de cinco tablas

La base `db_proyecto` utiliza `users`, `scheduled_classes`, `packages`, `purchases` y `reviews`: cinco tablas, cuatro llaves foráneas y 25 operaciones HTTP.

La API permite registro, inicio de sesión, roles, bloqueo temporal, gestión de clases y paquetes, compras, ventas y reseñas. El registro almacena hashes Argon2id con salt aleatorio y el login los verifica en el servidor. Las reseñas vinculan al usuario con la clase; no verifican asistencia. `capacity` representa el cupo máximo de una clase.

Reservas, asistencia, marcas personales y progreso por asistencia quedan fuera del alcance. RF-05, RF-06, RF-08, RF-09 y RF-10 no están implementados. RF-07 no comprueba asistencia y RF-11 tiene soporte de autorización en el backend, sin un panel web implementado.

## Requisitos y configuración

- Node.js 22 o superior.
- MySQL 8.0.16 o superior.

1. Ejecutar `npm ci` en la carpeta que contiene `package.json`.
2. Copiar `.env.example` como `.env` y completar las credenciales de MySQL, `JWT_SECRET` y las cuentas de demostración. Usar `DB_NAME=db_proyecto`.

`.env` y `node_modules/` se conservan fuera del repositorio. Cada persona crea su configuración local e instala las dependencias.

## Crear una base nueva

Ejecutar:

```bash
npm run db:setup
npm run db:seed
npm run db:demo
npm start
```

`db:setup` crea la base y utiliza `database/schema.sql`. También puede ejecutarse `database/db_proyecto.sql` en Workbench para crear la base manualmente. Se conservan ambos archivos porque cubren esas dos formas de instalación.

`db:seed` prepara el administrador y agrega paquetes de ejemplo si el catálogo está vacío. `db:demo` prepara el cliente de demostración. Swagger está en `http://localhost:5000/docs` y la especificación en `http://localhost:5000/openapi.json`.

## Actualizar la base existente revisada

Los scripts siguientes contienen las correcciones aplicadas a la base existente de cinco tablas. Abrirlos en MySQL Workbench y ejecutarlos completos, en este orden:

1. `database/actualización_db_proyecto.sql`: agrega las siete columnas requeridas que falten.
2. `database/corrección_registro_users.sql`: configura el identificador automático y los valores predeterminados de usuarios. Conserva el contador antiguo adicional.
3. `database/corrección_otras_tablas_fitpulse.sql`: configura los identificadores automáticos de las otras cuatro tablas y las fechas de compras y reseñas.

Los scripts apuntan a `db_proyecto` y conservan sus registros. Los cupos, horarios y descripciones incorporados para registros anteriores pueden quedar en `NULL` hasta completar sus valores reales. La API permite consultar esas clases; para modificarlas se deben completar los datos obligatorios.

Después, ejecutar `npm run db:setup`. La comprobación del arranque revisa tablas y nombres de columnas. Para consultar tipos, valores predeterminados, `AUTO_INCREMENT` y relaciones, usar `database/verificar_esquema.sql`.

La tabla de usuarios puede conservar una columna antigua adicional. Las columnas usadas para el bloqueo son `failed_login_attempts` y `locked_until`; por eso no se presenta el número de columnas de una base existente como un total fijo.

### Migrar las contraseñas del corte anterior

Detener la API, guardar una copia privada de la base existente e instalar las dependencias actualizadas con `npm ci`. Con las credenciales de esa base en `.env`, ejecutar:

```bash
npm run db:migrate-passwords
npm start
```

La migración transforma los valores en texto plano de `users.password` en hashes Argon2id. Conserva los identificadores, las contraseñas originales de acceso y los demás datos de las cuentas. Una segunda ejecución omite los hashes existentes. Si falla una actualización, la transacción revierte todos sus cambios. El login actualizado rechaza las cuentas que todavía conservan texto plano: no incluye una comparación alternativa de texto.

Las bases nuevas no necesitan esta migración: registro, `db:seed` y `db:demo` ya generan hashes. El procedimiento y los resultados están en [la documentación de autenticación](docs/third-cut/password-security.md).

## Pruebas y evidencias

Crear una base exclusiva de pruebas cuyo nombre termine en `_test`, configurar `TEST_DB_NAME` y ejecutar:

```bash
npm run test:passwords
npm test
npm run test:credential-tools
```

Las pruebas generan datos ficticios y escriben su resultado en `evidence/test-results.json`. La colección está en `evidence/FitPulse.postman_collection.json`: completar sus variables de credenciales y ejecutar las carpetas en orden.

`evidence/test-results.json` corresponde a la última ejecución de las pruebas de integración. `evidence/credential-tools-results.json` registra las pruebas de los comandos de creación de cuentas y migración. Cada evidencia incluye su fecha; los demás resultados conservan las fechas de sus ejecuciones originales. Las verificaciones manuales en Swagger no actualizan automáticamente estos archivos.

## Carpetas

| Carpeta | Contenido |
| --- | --- |
| `src/` | Rutas, controladores, servicios, repositorios y configuración. |
| `database/` | Esquema, creación manual, actualizaciones y consultas de verificación. |
| `scripts/` | Preparación de la base y datos de demostración. |
| `docs/` | Especificación OpenAPI y página de documentación. |
| `tests/` | Pruebas de integración. |
| `evidence/` | Colección Postman y resultados de ejecuciones. |

## Alcance pendiente del tercer corte

El almacenamiento en texto plano del corte anterior fue reemplazado por Argon2id; la migración debe aplicarse también a cada instalación existente. La interfaz web integrada y las pantallas de progreso y marcas personales todavía no están implementadas en esta rama. El modelo actual de cinco tablas no almacena esos dos últimos recursos. La mejora de autenticación propuesta, aún sin implementar, es un segundo factor con WebAuthn para administradores.
