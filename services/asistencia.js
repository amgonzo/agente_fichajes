const { crearDriver } =
    require("../drivers/factory");


// =========================================================
// BLOQUEOS POR LECTOR
// =========================================================
//
// Cada reloj tiene su propio bloqueo.
//
// Ejemplo:
//
// Reloj #1 ocupado
//     ↓
// otra operación sobre 192.168.1.235:4370 espera
//
// Mientras tanto, un reloj diferente puede trabajar
// normalmente.
//
// =========================================================

const bloqueosLectores =
    new Map();


async function adquirirBloqueo(
    marca,
    ip,
    puerto
) {

    const clave =
        `${String(marca).trim().toLowerCase()}|${String(ip).trim()}|${Number(puerto)}`;

    const bloqueoAnterior =
        bloqueosLectores.get(clave) || null;

    let liberar;

    const bloqueoActual =
        new Promise(resolve => {
            liberar = resolve;
        });

    bloqueosLectores.set(
        clave,
        bloqueoActual
    );

    if (bloqueoAnterior) {

        console.log(
            `Lector ocupado. Esperando turno: ${marca} ${ip}:${puerto}`
        );

        await bloqueoAnterior;
    }

    console.log(
        `Lector disponible: ${marca} ${ip}:${puerto}`
    );

    let liberado = false;

    return () => {

        if (liberado) {
            return;
        }

        liberado = true;

        if (
            bloqueosLectores.get(clave) ===
            bloqueoActual
        ) {

            bloqueosLectores.delete(
                clave
            );
        }

        liberar();
    };
}


// =========================================================
// EJECUCIÓN COMÚN CON DRIVER
// =========================================================

async function ejecutarConDriver(
    marca,
    ip,
    puerto,
    operacion
) {

    const liberar =
        await adquirirBloqueo(
            marca,
            ip,
            puerto
        );

    let driver = null;

    try {

        driver =
            crearDriver(
                marca,
                ip,
                puerto
            );

        await driver.conectar();

        return await operacion(
            driver
        );

    } finally {

        if (
            driver &&
            typeof driver.desconectar === "function"
        ) {

            try {

                await driver.desconectar();

            } catch (error) {

                const mensaje =
                    error?.err?.message ||
                    error?.message ||
                    "Error desconocido.";

                console.error(
                    `Error desconectando ${marca} ${ip}:${puerto}:`,
                    mensaje
                );
            }
        }

        liberar();
    }
}


// =========================================================
// INFORMACIÓN DEL LECTOR
// =========================================================

async function leerInfo(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.leerInfo()
    );
}


// =========================================================
// USUARIOS DEL LECTOR
// =========================================================

async function leerUsuarios(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.leerUsuarios()
    );
}


// =========================================================
// FICHADAS
// =========================================================

async function leerFichadas(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.leerFichadas()
    );
}


// =========================================================
// BORRAR FICHADAS
// =========================================================

async function borrarFichadas(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.borrarFichadas()
    );
}


// =========================================================
// CARGAR EMPLEADO
// =========================================================

async function cargarEmpleado(
    marca,
    ip,
    puerto,
    empleado
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.cargarEmpleado(
                empleado
            )
    );
}


// =========================================================
// SINCRONIZAR EMPLEADOS
// =========================================================

async function sincronizarEmpleados(
    marca,
    ip,
    puerto,
    empleados
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.sincronizarEmpleados(
                empleados
            )
    );
}


// =========================================================
// SINCRONIZAR HORA
// =========================================================

async function sincronizarHora(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver =>
            driver.sincronizarHora()
    );
}


// =========================================================
// EXPORTACIONES
// =========================================================

module.exports = {

    leerInfo,

    leerUsuarios,

    leerFichadas,

    borrarFichadas,

    cargarEmpleado,

    sincronizarEmpleados,

    sincronizarHora
};