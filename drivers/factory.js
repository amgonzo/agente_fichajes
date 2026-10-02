const DriverZKTeco = require("./zkteco");
const DriverAnviz = require("./anviz");

function crearDriver(marca, ip, puerto) {

    switch (marca.toLowerCase()) {

        case "zkteco":
            return new DriverZKTeco(ip, puerto);

        case "anviz":
            return new DriverAnviz(ip, puerto);

        default:
            throw new Error(
                `Marca no soportada: ${marca}`
            );
    }

}

module.exports = {
    crearDriver
};