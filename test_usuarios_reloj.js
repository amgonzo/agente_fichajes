const {
    leerUsuarios
} = require("./services/asistencia");

async function main() {

    try {

        console.log("");
        console.log("======================================");
        console.log("LEYENDO USUARIOS DEL K40");
        console.log("======================================");
        console.log("");

        const usuarios =
            await leerUsuarios(
                "zkteco",
                "192.168.1.235",
                4370
            );

        console.log(
            `Cantidad de usuarios: ${usuarios.length}`
        );

        console.log("");

        console.dir(
            usuarios,
            {
                depth: null
            }
        );

        console.log("");
        console.log("======================================");

    } catch (error) {

        console.error("");
        console.error(
            "ERROR LEYENDO USUARIOS DEL K40:"
        );
        console.error("");
        console.error(error);
        console.error("");

    }
}

main();