const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_LOCAL_HOST || "127.0.0.1",
    port: Number(process.env.DB_LOCAL_PORT || 3306),
    database: process.env.DB_LOCAL_NAME,
    user: process.env.DB_LOCAL_USER,
    password: process.env.DB_LOCAL_PASS,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: "utf8mb4"
});

async function probarConexion() {
    const connection = await pool.getConnection();

    try {
        await connection.query("SELECT 1");
        console.log("MariaDB local conectada.");
    } finally {
        connection.release();
    }
}

async function guardarFichadas(fichadas) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const guardadas = [];

        for (const fichada of fichadas) {

            const [resultado] = await connection.execute(
                `
                INSERT INTO fichadas_locales
                (
                    device_user_id,
                    idlector,
                    fecha,
                    hora
                )
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    idfichada = LAST_INSERT_ID(idfichada)
                `,
                [
                    String(fichada.deviceUserId),
                    Number(fichada.idlector),
                    fichada.fecha,
                    fichada.hora
                ]
            );

            guardadas.push({
                idfichada: resultado.insertId,
                deviceUserId: String(fichada.deviceUserId),
                idlector: Number(fichada.idlector),
                fecha: fichada.fecha,
                hora: fichada.hora
            });
        }

        await connection.commit();

        return guardadas;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();
    }
}

async function obtenerFichadasPendientes(limite = 50) {

    const [filas] = await pool.execute(
        `
        SELECT
            idfichada,
            device_user_id,
            idlector,
            fecha,
            hora,
            fecha_lectura,
            estado,
            intentos,
            fecha_envio,
            fecha_confirmacion,
            ultimo_error
        FROM fichadas_locales
        WHERE estado = 'pendiente'
        ORDER BY idfichada ASC
        LIMIT ?
        `,
        [Number(limite)]
    );

    return filas;
}

async function marcarFichadasConfirmadas(ids) {

    if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
    }

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        let actualizadas = 0;

        for (const id of ids) {

            const idfichada = Number(id);

            if (!idfichada) {
                continue;
            }

            const [resultado] = await connection.execute(
                `
                UPDATE fichadas_locales
                SET
                    estado = 'confirmada',
                    fecha_confirmacion = NOW(),
                    fecha_envio = COALESCE(fecha_envio, NOW()),
                    ultimo_error = NULL
                WHERE idfichada = ?
                  AND estado IN ('pendiente', 'error')
                `,
                [idfichada]
            );

            actualizadas += resultado.affectedRows;
        }

        await connection.commit();

        return actualizadas;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();
    }
}

async function registrarErrorFichadas(ids, mensaje) {

    if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
    }

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        let actualizadas = 0;

        for (const id of ids) {

            const idfichada = Number(id);

            if (!idfichada) {
                continue;
            }

            const [resultado] = await connection.execute(
                `
                UPDATE fichadas_locales
                SET
                    intentos = intentos + 1,
                    fecha_envio = NOW(),
                    ultimo_error = ?
                WHERE idfichada = ?
                  AND estado = 'pendiente'
                `,
                [
                    String(mensaje).substring(0, 65000),
                    idfichada
                ]
            );

            actualizadas += resultado.affectedRows;
        }

        await connection.commit();

        return actualizadas;

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();
    }
}

async function marcarFichadaError(idfichada, mensaje) {

    const [resultado] = await pool.execute(
        `
        UPDATE fichadas_locales
        SET
            estado = 'error',
            intentos = intentos + 1,
            fecha_envio = NOW(),
            ultimo_error = ?
        WHERE idfichada = ?
          AND estado = 'pendiente'
        `,
        [
            String(mensaje).substring(0, 65000),
            Number(idfichada)
        ]
    );

    return resultado.affectedRows;
}

async function reintentarFichada(idfichada) {

    const id = Number(idfichada);

    if (!id) {
        throw new Error("ID de fichada inválido.");
    }

    const [resultado] = await pool.execute(
        `
        UPDATE fichadas_locales
        SET
            estado = 'pendiente'
        WHERE idfichada = ?
          AND estado = 'error'
        `,
        [id]
    );

    if (resultado.affectedRows !== 1) {
        throw new Error(
            "La fichada no existe o no se encuentra en estado de error."
        );
    }

    return true;
}

module.exports = {
    pool,
    probarConexion,
    guardarFichadas,
    obtenerFichadasPendientes,
    marcarFichadasConfirmadas,
    registrarErrorFichadas,
    marcarFichadaError,
    reintentarFichada
};