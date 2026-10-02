const DriverBiometrico = require("./base");

class DriverAnviz extends DriverBiometrico {

    constructor(ip, puerto = 5010) {
        super();

        this.ip = ip;
        this.puerto = puerto;
    }

    async conectar() {

        console.log(
            `Conectando Anviz ${this.ip}:${this.puerto}`
        );

        return true;
    }

    async leerFichadas() {

        return [
            {
                legajo: "456",
                fecha: "2026-07-23 08:05:00"
            }
        ];

    }

    async leerInfo() {

    return {
        modelo: "GC100",
        ip: this.ip,
        puerto: this.puerto,
        usuarios: 0,
        fichadas: 0
    };

}

}

module.exports = DriverAnviz;