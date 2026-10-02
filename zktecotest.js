const ZKAttendanceClient = require("zk-attendance-sdk").default;

async function main() {

    const zk = new ZKAttendanceClient(
        "192.168.1.235",
        4370,
        10000,
        4000
    );

    try {

        console.log("Conectando...");

        await zk.createSocket();

        console.log("Conectado");

        console.log("INFO:");

        const info = await zk.getInfo();

        console.dir(
            info,
            { depth: null }
        );

        console.log("USUARIOS:");

        const usuarios =
            await zk.getUsers();

        console.dir(
            usuarios,
            { depth: null }
        );

        console.log("FICHADAS:");

        const fichadas =
            await zk.getAttendances();

        console.dir(
            fichadas,
            { depth: null }
        );

    } catch (error) {

        console.error("ERROR:");

        console.error(error);

    } finally {

        try {
            await zk.disconnect();
        } catch (e) {}

        console.log("Desconectado");
    }
}

main();