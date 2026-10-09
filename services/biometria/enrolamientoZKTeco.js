const Zklib = require("zklib-ts");

class EnrolamientoZKTeco {

    constructor(ip, puerto = 4370) {
        this.ip = ip;
        this.puerto = puerto;
        this.zk = null;
    }

    async conectar() {
        console.log(
            `Conectando a ZKTeco ${this.ip}:${this.puerto}`
        );

        this.zk = new Zklib(
            this.ip,
            this.puerto,
            10000,
            10000,
            0,
            true
        );

        await this.zk.createSocket();

        console.log("ZKTeco conectado.");

        return true;
    }

    async enrolarHuella(documento, idDedo) {

        // =====================================================
        // VALIDACIONES
        // =====================================================

        documento = String(documento || "").trim();

        if (!documento) {
            throw new Error("Falta documento del empleado.");
        }

        if (
            idDedo === undefined ||
            idDedo === null
        ) {
            throw new Error("Falta idDedo.");
        }

        idDedo = Number(idDedo);

        if (
            !Number.isInteger(idDedo) ||
            idDedo < 0 ||
            idDedo > 9
        ) {
            throw new Error("Id de dedo inválido.");
        }

        let cantidadCapturas = 0;

        console.log("");
        console.log("======================================");
        console.log("INICIANDO ENROLAMIENTO");
        console.log("======================================");
        console.log(
            `Documento / Usuario K40: ${documento}`
        );
        console.log(
            `Dedo: ${idDedo}`
        );
        console.log("");

        // =====================================================
        // VERIFICAR CONEXIÓN
        // =====================================================

        if (!this.zk) {
            throw new Error(
                `No existe conexión activa con el lector ${this.ip}:${this.puerto}`
            );
        }

        // =====================================================
        // ESCUCHAR EVENTOS
        // =====================================================

        await this.zk.getRealTimeLogs((evento) => {

            if (
                evento &&
                evento.event === 256
            ) {

                cantidadCapturas++;

                console.log(
                    `Captura de huella ${cantidadCapturas}/3`
                );

                if (evento.payload) {

                    console.log(
                        `Score: ${evento.payload.score}`
                    );
                }
            }
        });

        // =====================================================
        // CANCELAR OPERACIÓN ANTERIOR
        // =====================================================

        console.log(
            "Cancelando operación anterior..."
        );

        await this.zk.executeCmd(
            62,
            ""
        );

        // =====================================================
        // DATOS DE ENROLAMIENTO
        //
        // El K40 recibe como usuario el DOCUMENTO.
        // =====================================================

        const datosEnroll = Buffer.alloc(
            26,
            0
        );

        datosEnroll.write(
            documento,
            0,
            24,
            "ascii"
        );

        datosEnroll.writeUInt8(
            idDedo,
            24
        );

        // Flag = 1
        datosEnroll.writeUInt8(
            1,
            25
        );

        // =====================================================
        // INICIAR ENROLAMIENTO
        // =====================================================

        console.log(
            "Iniciando enrolamiento..."
        );

        await this.zk.executeCmd(
            61,
            datosEnroll
        );

        // =====================================================
        // INICIAR CAPTURA
        // =====================================================

        console.log(
            "Iniciando captura..."
        );

        await this.zk.executeCmd(
            60,
            ""
        );

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "EL K40 DEBE PEDIR EL DEDO"
        );
        console.log(
            "======================================"
        );
        console.log(
            "Colocá el mismo dedo 3 veces."
        );
        console.log("");

        // =====================================================
        // ESPERAR 3 CAPTURAS
        // =====================================================

        const inicio = Date.now();

        while (cantidadCapturas < 3) {

            if (
                Date.now() - inicio >
                60000
            ) {
                throw new Error(
                    "Tiempo agotado esperando las 3 capturas."
                );
            }

            await new Promise(
                resolve =>
                    setTimeout(resolve, 250)
            );
        }

        console.log("");
        console.log(
            "3 capturas recibidas."
        );

        // =====================================================
        // DAR TIEMPO AL K40 PARA GUARDAR
        // =====================================================

        await new Promise(
            resolve =>
                setTimeout(resolve, 1000)
        );

        // =====================================================
        // LEER PLANTILLA
        // =====================================================

        console.log(
            "Leyendo plantilla..."
        );

        const plantilla =
            await this.zk.getUserTemplate(
                documento,
                idDedo
            );

        if (!plantilla) {
            throw new Error(
                "El K40 no devolvió la plantilla."
            );
        }

        if (
            !plantilla.template ||
            !Buffer.isBuffer(plantilla.template)
        ) {
            throw new Error(
                "La plantilla recibida no es válida."
            );
        }

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "ENROLAMIENTO COMPLETADO"
        );
        console.log(
            "======================================"
        );

        console.log(
            `Usuario K40: ${plantilla.uid}`
        );

        console.log(
            `Dedo: ${plantilla.fid}`
        );

        console.log(
            `Valid: ${plantilla.valid}`
        );

        console.log(
            `Tamaño: ${plantilla.size}`
        );

        console.log(
            `Marca: ${plantilla.mark}`
        );

        console.log("");

        return {
            ok: true,

            usuario: plantilla.uid,

            dedo: plantilla.fid,

            valid: plantilla.valid,

            size: plantilla.size,

            mark: plantilla.mark,

            template: plantilla.template
        };
    }

    async desconectar() {

        if (this.zk) {

            await this.zk.disconnect();

            this.zk = null;

            console.log(
                "ZKTeco desconectado."
            );
        }
    }
}

module.exports = EnrolamientoZKTeco;