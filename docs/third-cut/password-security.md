# Autenticación del tercer corte: aporte de Laura

## Cambio respecto al corte anterior

En el corte 2, `users.password` conservaba la contraseña en texto plano y el login la comparaba directamente. Esta versión cambia ambos pasos: el registro calcula un hash Argon2id antes de insertar la cuenta y el login usa `argon2.verify`. El token JWT y el bloqueo por cinco intentos fallidos se conservan. Ninguna respuesta incluye la contraseña ni su hash.

Se eligió Argon2id porque OWASP lo recomienda para almacenar contraseñas [1]. Aumenta el costo de probar contraseñas después de una filtración de la base. La política está concentrada en `src/config/password-policy.js`: 19 456 KiB de memoria, dos iteraciones, paralelismo de uno y salida de 32 bytes. Son parámetros explícitos que deben medirse de nuevo en el equipo donde se vaya a desplegar; las pruebas locales no garantizan el mismo rendimiento en otro servidor.

`argon2` genera un salt aleatorio de 16 bytes para cada hash [2]. Se almacena junto con el algoritmo, la versión, los parámetros y el resultado dentro de la misma cadena codificada. No necesita otra columna y no se reutiliza entre cuentas. Dos usuarios con la misma contraseña reciben valores almacenados distintos. Se mantiene el límite de entrada de 8 a 200 caracteres de la API; la verificación usa el texto completo, incluidos los caracteres acentuados.

## Migración de cuentas existentes

La migración debe ejecutarse en el servidor con la API detenida. No se hace desde MySQL Workbench ni desde una pantalla del cliente: necesita la biblioteca de hashing de Node.js.

1. Guardar una copia privada de la base y conservarla fuera del repositorio.
2. Instalar la versión actualizada con `npm ci`.
3. Confirmar en `.env` que `DB_NAME` corresponde a la base que se quiere migrar.
4. Ejecutar `npm run db:migrate-passwords`.
5. Revisar los conteos `inspected`, `migrated` y `alreadyHashed`. El comando no imprime credenciales.
6. Iniciar la API y comprobar el login de una cuenta existente con su contraseña habitual.

El servicio bloquea las filas durante una transacción y actualiza solamente `password`. Si una actualización falla, todas se revierten. Reconoce el formato Argon2id y lo omite en ejecuciones posteriores; así evita aplicar hashing sobre otro hash. Conserva identificadores, nombres, roles, estados, fechas y contadores. No requiere agregar tablas ni cambiar `VARCHAR(255)` del esquema revisado.

El comando está destinado a la transición desde el almacenamiento en texto plano del corte 2. No convierte hashes de otros algoritmos. Las cuentas nuevas ya se crean con Argon2id, tanto por el endpoint público como por los comandos del administrador y del cliente de demostración. El login no acepta texto plano como alternativa si alguien olvida ejecutar la migración.

Para verificar el formato sin mostrar contraseñas ni hashes completos:

```sql
SELECT
  COUNT(*) AS total_users,
  SUM(password LIKE '$argon2id$%') AS users_with_argon2id
FROM users;
```

El prefijo permite revisar el formato; el funcionamiento se comprueba además iniciando sesión. Las pruebas automáticas migran datos ficticios en una base cuyo nombre termina en `_test`; no demuestran que la base del computador de cada integrante ya haya sido migrada.

## Verificación reproducible

Con una base exclusiva configurada en `TEST_DB_NAME`, ejecutar:

```bash
npm run test:passwords
npm test
npm run test:credential-tools
```

Las pruebas de contraseña comprueban salts independientes, contraseña correcta e incorrecta, rechazo del texto plano almacenado y ausencia de truncamiento. Las pruebas HTTP comprueban el registro, el login antes y después de migrar, la conservación de los metadatos y los permisos ya existentes. Las pruebas de comandos comprueban que las cuentas de demostración se creen con hash, que repetir los comandos conserve las cuentas y que un fallo durante la migración produzca una reversión completa.

Los resultados de integración están en `evidence/test-results.json` y los de los comandos en `evidence/credential-tools-results.json`. No incluyen contraseñas, hashes ni tokens reales. Una ejecución correcta en esta base de pruebas respalda el comportamiento probado; no equivale a una auditoría de seguridad completa ni completa las pantallas pendientes.

## Limitación y propuesta de mejora

El hashing protege el almacenamiento, pero no impide que alguien inicie sesión con una contraseña que obtuvo mediante phishing o reutilización en otro servicio. El bloqueo temporal limita intentos consecutivos; no detiene un acceso con una contraseña correcta robada. Para FitPulse, este riesgo afecta especialmente al administrador, que puede modificar clases, paquetes y estados de usuarios y consultar ventas.

Se propone exigir a los administradores un segundo factor con WebAuthn. OWASP recomienda autenticadores resistentes al phishing que vinculan la autenticación con el origen legítimo [3]. Este paso reduciría la dependencia de una contraseña reutilizable. Requeriría enrolamiento de credenciales, verificación de desafíos, recuperación de acceso y pruebas con dispositivos compatibles. No se implementó en este alcance porque el punto asignado exige migración, registro y login con hashing y salt; agregar el ciclo completo del segundo factor introduce otro flujo de autenticación y necesita validación adicional. No se presenta la propuesta como una función existente.

## Referencias

[1] OWASP Foundation, “Password Storage Cheat Sheet,” OWASP Cheat Sheet Series. [En línea]. Disponible: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html. [Consulta: 14-nov-2026].

[2] Colaboradores de node-argon2, “node-argon2,” documentación y código de la biblioteca, versión 0.44.0. [En línea]. Disponible: https://github.com/ranisalt/node-argon2. [Consulta: 14-nov-2026].

[3] OWASP Foundation, “Multifactor Authentication Cheat Sheet,” OWASP Cheat Sheet Series. [En línea]. Disponible: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html. [Consulta: 14-nov-2026].
