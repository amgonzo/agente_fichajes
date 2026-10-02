const ZKAttendanceClient =
    require("zk-attendance-sdk").default;

const DriverBiometrico =
    require("./base");

class DriverZKTeco extends DriverBiometrico {

    constructor(ip, puerto = 4370) {

        super();

        this.ip = ip;
        this.puerto = puerto;

        this.zk = null;
    }

    async conectar() {

        console.log(
            `Conectando a ZKTeco ${this.ip}:${this.puerto}`
        );

        this.zk = new ZKAttendanceClient(
            this.ip,
            this.puerto,
            10000,
            4000
        );

        await this.zk.createSocket();

        console.log(
            "ZKTeco conectado"
        );

        return true;
    }

    async leerInfo() {

        const info =
            await this.zk.getInfo();

        return info;
    }

    async leerUsuarios() {

        const resultado =
            await this.zk.getUsers();

        return resultado.data || [];
    }

    async cargarEmpleado(empleado) {

        if (
            !empleado ||
            typeof empleado !== "object"
        ) {
            throw new Error(
                "Datos de empleado inválidos."
            );
        }

        const idempleado =
            Number(empleado.idempleado);

        const documento =
            String(
                empleado.documento || ""
            ).trim();

        const nombre =
            String(
                empleado.nombre || ""
            ).trim();

        const apellido =
            String(
                empleado.apellido || ""
            ).trim();

        const tarjeta =
            empleado.tarjeta == null
                ? ""
                : String(
                    empleado.tarjeta
                ).trim();

        if (!idempleado) {
            throw new Error(
                "Falta idempleado."
            );
        }

        if (!documento) {
            throw new Error(
                "Falta documento del empleado."
            );
        }

        if (!nombre && !apellido) {
            throw new Error(
                "Falta nombre del empleado."
            );
        }

        const nombreCompleto =
            `${nombre} ${apellido}`.trim();

        const cardno =
            tarjeta !== ""
                ? tarjeta
                : 0;

        console.log(
            `Cargando empleado ${idempleado} / ${documento} - ${nombreCompleto}`
        );

        const resultado =
            await this.zk.setUser(
                idempleado,
                documento,
                nombreCompleto,
                "",
                0,
                cardno
            );

        return {

            ok: true,

            resultado,

            empleado: {

                idempleado,

                documento,

                nombre: nombreCompleto,

                tarjeta:
                    tarjeta || null

            }

        };
    }

    async leerFichadas() {

        const cantidad =
            await this.zk.getAttendanceSize();

        console.log(
            "Cantidad de fichadas en el lector:",
            cantidad
        );

        if (Number(cantidad) === 0) {
            return [];
        }

        const resultado =
            await this.zk.getAttendances();

        return resultado.data || [];
    }
    async sincronizarHora() {

        const ahora =
            new Date();

        return await this.zk.setTime(
            ahora
        );
    }

    async desconectar() {

        if (this.zk) {

            await this.zk.disconnect();

            this.zk = null;
        }
    }

    async borrarFichadas() {

        const resultado =
            await this.zk.clearAttendanceLog();

        return resultado;
    }
}

module.exports =
    DriverZKTeco;