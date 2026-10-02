const { crearDriver } =
    require("../drivers/factory");


async function ejecutarConDriver(
    marca,
    ip,
    puerto,
    operacion
) {

    const driver =
        crearDriver(
            marca,
            ip,
            puerto
        );

    try {

        await driver.conectar();

        return await operacion(driver);

    } finally {

        if (typeof driver.desconectar === "function") {
            await driver.desconectar();
        }

    }

}


async function leerInfo(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver => driver.leerInfo()
    );

}


async function leerUsuarios(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver => driver.leerUsuarios()
    );

}


async function leerFichadas(marca, ip, puerto) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver => driver.leerFichadas()
    );
}

async function borrarFichadas(marca, ip, puerto) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver => driver.borrarFichadas()
    );
}

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
        driver => driver.cargarEmpleado(empleado)
    );

}


async function sincronizarHora(
    marca,
    ip,
    puerto
) {

    return await ejecutarConDriver(
        marca,
        ip,
        puerto,
        driver => driver.sincronizarHora()
    );

}


module.exports = {
    leerInfo,
    leerUsuarios,
    leerFichadas,
    cargarEmpleado,
    sincronizarHora,
    borrarFichadas
};