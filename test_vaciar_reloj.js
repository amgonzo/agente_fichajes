const ZKAttendanceClient =
    require("zk-attendance-sdk").default;


// =========================================================
// CONFIGURACIÓN
// =========================================================

const IP = "192.168.1.235";
const PUERTO = 4370;


// =========================================================
// TEST VACIAR USUARIOS DEL K40
// =========================================================

async function main() {

    let zk = null;

    try {

        console.log("");
        console.log("======================================");
        console.log("TEST VACIAR USUARIOS ZKTECO");
        console.log("======================================");
        console.log(
            `Reloj: ${IP}:${PUERTO}`
        );
        console.log("");

        // -------------------------------------------------
        // CONECTAR
        // -------------------------------------------------

        console.log(
            "Conectando al reloj..."
        );

        zk = new ZKAttendanceClient(
            IP,
            PUERTO,
            10000,
            4000
        );

        await zk.createSocket();

        console.log(
            "Conexión OK."
        );
        console.log("");

        // -------------------------------------------------
        // LEER USUARIOS
        // -------------------------------------------------

        console.log(
            "Leyendo usuarios..."
        );

        const resultado =
            await zk.getUsers();

        const usuarios =
            resultado.data || [];

        console.log(
            `Usuarios encontrados: ${usuarios.length}`
        );

        console.log("");

        if (usuarios.length === 0) {

            console.log(
                "El reloj ya está vacío."
            );

            return;
        }

        // -------------------------------------------------
        // MOSTRAR USUARIOS
        // -------------------------------------------------

        console.log(
            "Usuarios actuales:"
        );

        usuarios.forEach((usuario, indice) => {

            console.log(
                `${indice + 1}. ` +
                `UID=${usuario.uid} | ` +
                `USERID=${usuario.userId} | ` +
                `Nombre=${usuario.name || ""}`
            );

        });

        console.log("");

        // -------------------------------------------------
        // BORRAR USUARIOS
        // -------------------------------------------------

        for (const usuario of usuarios) {

            const uid =
                Number(usuario.uid);

            if (!Number.isInteger(uid)) {

                console.log(
                    `UID inválido: ${usuario.uid}`
                );

                continue;
            }

            console.log(
                `Eliminando UID=${uid} ` +
                `(USERID=${usuario.userId})...`
            );

            try {

                await zk.deleteUser(uid);

                console.log(
                    `  OK`
                );

            } catch (error) {

                console.log(
                    `  ERROR: ` +
                    `${error.message || error}`
                );

            }

        }

        console.log("");

        // -------------------------------------------------
        // VERIFICAR
        // -------------------------------------------------

        console.log(
            "Verificando usuarios restantes..."
        );

        const resultadoFinal =
            await zk.getUsers();

        const usuariosFinales =
            resultadoFinal.data || [];

        console.log("");

        console.log(
            `Usuarios restantes: ${usuariosFinales.length}`
        );

        if (usuariosFinales.length === 0) {

            console.log("");
            console.log(
                "======================================"
            );
            console.log(
                "RELOJ VACIADO CORRECTAMENTE"
            );
            console.log(
                "======================================"
            );

        } else {

            console.log("");
            console.log(
                "======================================"
            );
            console.log(
                "ATENCION: QUEDARON USUARIOS"
            );
            console.log(
                "======================================"
            );

            usuariosFinales.forEach((usuario) => {

                console.log(
                    `UID=${usuario.uid} | ` +
                    `USERID=${usuario.userId} | ` +
                    `Nombre=${usuario.name || ""}`
                );

            });

        }

    } catch (error) {

        console.error("");
        console.error(
            "ERROR:",
            error.message || error
        );

    } finally {

        // -------------------------------------------------
        // DESCONECTAR
        // -------------------------------------------------

        if (zk) {

            try {

                await zk.disconnect();

                console.log("");
                console.log(
                    "Reloj desconectado."
                );

            } catch (error) {

                console.log(
                    "Error desconectando:",
                    error.message || error
                );

            }

        }

    }

}


main();