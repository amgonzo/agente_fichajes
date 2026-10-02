const ZKLib = require("node-zklib");

async function probar() {

    const zk = new ZKLib(
        "192.168.1.235",
        4370,
        10000,
        4000
    );

    try {

        console.log("Conectando al ZKTeco...");

        await zk.createSocket();

        console.log("✅ CONECTADO");

        console.log("\n=== INFORMACIÓN DEL EQUIPO ===");

        const info = await zk.getInfo();

        console.log(info);

        console.log("\n=== USUARIOS ===");

        const usuarios = await zk.getUsers();

        console.log(usuarios);

        console.log("\n=== FICHADAS ===");

        const fichadas = await zk.getAttendances();

        console.log(fichadas);

        await zk.disconnect();

        console.log("\n✅ Desconectado");

    } catch (error) {

        console.error("\n❌ ERROR:");
        console.error(error);

        try {
            await zk.disconnect();
        } catch (_) {}
    }
}

probar();