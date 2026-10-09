const ZKAttendanceClient =
    require("zk-attendance-sdk").default;

async function probar() {

    const zk = new ZKAttendanceClient(
        "192.168.1.235",
        4370,
        15000,
        5000
    );

    try {

        console.log("CONECTANDO...");

        await zk.createSocket();

        console.log(
            "CONECTADO:",
            zk.getConnectionType()
        );

        console.log("PROBANDO getInfo()...");

        const info =
            await zk.getInfo();

        console.log(
            "GETINFO OK:",
            info
        );

        console.log("PROBANDO getUsers()...");

        const usuarios =
            await zk.getUsers();

        console.log(
            "GETUSERS OK:"
        );

        console.log(
            usuarios
        );

    } catch (error) {

        console.error(
            "ERROR COMPLETO:"
        );

        console.error(
            error
        );

    } finally {

        try {
            await zk.disconnect();
        } catch (e) {
        }

    }
}

probar();