const authService = require("./auth");
const agentService = require("./agent");
const asistenciaService = require("./asistencia");
const db = require("./db");

const configuracionLectores =
    require("./configuracionLectores");

const lectorAutomatico =
    require("./lectorAutomatico");

const EnrolamientoZKTeco =
    require("./biometria/enrolamientoZKTeco");


class WorkerService {

    constructor() {

        this.ejecutando = false;
        this.procesando = false;

        this.intervalo = null;

        /*
         * Queremos detectar rápidamente tareas
         * prioritarias.
         */
        this.intervaloMs = 1000;
    }


    async iniciar() {

        if (this.ejecutando) {
            return;
        }

        this.ejecutando = true;

        console.log(
            "Worker de tareas iniciado."
        );

        /*
         * Primera consulta inmediata.
         */
        await this.procesarTareas();

        this.intervalo = setInterval(() => {

            this.procesarTareas();

        }, this.intervaloMs);
    }


    detener() {

        if (this.intervalo) {

            clearInterval(
                this.intervalo
            );

            this.intervalo = null;
        }

        this.ejecutando = false;

        console.log(
            "Worker de tareas detenido."
        );
    }


    async procesarTareas() {

        /*
         * Evita que una segunda ejecución
         * se superponga a una tarea que todavía
         * está siendo procesada.
         */
        if (this.procesando) {
            return;
        }

        this.procesando = true;

        try {

            const tarea =
                await this.obtenerTarea();

            if (!tarea) {
                return;
            }

            console.log(
                "======================================"
            );

            console.log(
                `TAREA RECIBIDA #${tarea.idtarea}`
            );

            console.log(
                "Acción:",
                tarea.accion
            );

            console.log(
                "Prioridad:",
                tarea.prioridad
            );

            console.log(
                "ID lector:",
                tarea.idlector
            );

            console.log(
                "ID empleado:",
                tarea.idempleado
            );

            console.log(
                "Datos:",
                tarea.datos
            );

            console.log(
                "======================================"
            );

            try {

                const respuesta =
                    await this.ejecutarTarea(
                        tarea
                    );

                await this.enviarResultado(
                    tarea.idtarea,
                    "completada",
                    respuesta
                );

                agentService.actividad();

                console.log(
                    `Tarea #${tarea.idtarea} completada.`
                );

            } catch (error) {

                console.error(
                    `Error ejecutando tarea #${tarea.idtarea}:`,
                    error.message
                );

                try {

                    await this.enviarResultado(
                        tarea.idtarea,
                        "error",
                        {
                            ok: false,
                            error: error.message
                        }
                    );

                } catch (resultadoError) {

                    /*
                     * Si la central cayó justo después
                     * de entregar la tarea, no hacemos nada
                     * más acá.
                     *
                     * La tarea seguirá en "procesando"
                     * hasta que decidamos implementar
                     * recuperación de tareas abandonadas.
                     */

                    console.error(
                        "No se pudo informar el resultado:",
                        resultadoError.message
                    );
                }

                agentService.actividad();
            }

        } catch (error) {

            /*
             * Esto normalmente será:
             *
             * - central caída
             * - timeout
             * - error HTTP
             * - respuesta inválida
             *
             * NO ponemos OFFLINE al Agent.
             *
             * En el siguiente ciclo se vuelve a intentar.
             */

            agentService.errorCentral(
                error
            );

            console.error(
                "Error consultando tareas:"
            );

            console.error(
                error.message
            );

        } finally {

            this.procesando = false;
        }
    }


    async obtenerTarea() {

        const apiUrl =
            process.env.API_CENTRAL_URL;

        const agentId =
            process.env.AGENT_ID;

        const token =
            process.env.AGENT_TOKEN;

        if (!apiUrl) {

            throw new Error(
                "Falta API_CENTRAL_URL en .env"
            );
        }

        if (!agentId) {

            throw new Error(
                "Falta AGENT_ID en .env"
            );
        }

        if (!token) {

            throw new Error(
                "Falta AGENT_TOKEN en .env"
            );
        }

        const response =
            await fetch(
                `${apiUrl}/tareas.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        agent_id:
                            agentId,

                        token:
                            token,

                        accion:
                            "obtener"
                    })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                `Respuesta inválida del servidor central. HTTP ${response.status}`
            );
        }

        /*
         * Si las credenciales del Agent fueron
         * rechazadas, marcamos la autenticación
         * como inválida.
         *
         * En el próximo ciclo se volverá a intentar
         * normalmente.
         */
        if (
            response.status === 401 ||
            response.status === 403
        ) {

            authService.marcarDesconectado(
                data?.msg ||
                `Error de autenticación. HTTP ${response.status}`
            );
        }

        if (
            !response.ok ||
            data.status !== "ok"
        ) {

            throw new Error(
                data.msg ||
                `Error consultando tareas. HTTP ${response.status}`
            );
        }

        agentService.contactoCentral();

        if (!data.hay_tarea) {
            return null;
        }

        return data.tarea;
    }


    async ejecutarTarea(
        tarea
    ) {

        let datos = {};

        if (tarea.datos) {

            try {

                datos =
                    typeof tarea.datos === "string"
                        ? JSON.parse(tarea.datos)
                        : tarea.datos;

            } catch (error) {

                throw new Error(
                    "Los datos de la tarea no contienen un JSON válido."
                );
            }
        }

        switch (tarea.accion) {

            case "cargar_empleado":

                return await this.cargarEmpleado(
                    tarea,
                    datos
                );

            case "enrolar_huella":

                return await this.enrolarHuella(
                    tarea,
                    datos
                );

            case "leer_fichadas":

                return await this.leerFichadas(
                    tarea,
                    datos
                );

            case "reintentar_fichada":

                return await this.reintentarFichada(
                    tarea,
                    datos
                );

            case "actualizar_configuracion":

                return await this.actualizarConfiguracion(
                    tarea,
                    datos
                );

            default:

                throw new Error(
                    `Acción no soportada por el Agent: ${tarea.accion}`
                );
        }
    }


    async cargarEmpleado(
        tarea,
        datos
    ) {

        const marca =
            String(
                datos.marca || ""
            ).trim();

        const ip =
            String(
                datos.ip || ""
            ).trim();

        const puerto =
            Number(
                datos.puerto || 4370
            );

        if (!marca) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la marca del lector.`
            );
        }

        if (!ip) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la IP del lector.`
            );
        }

        if (!tarea.idempleado) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica el empleado.`
            );
        }

        return await asistenciaService.cargarEmpleado(
            marca,
            ip,
            puerto,
            {
                idempleado:
                    Number(
                        tarea.idempleado
                    ),

                documento:
                    datos.documento,

                nombre:
                    datos.nombre,

                apellido:
                    datos.apellido,

                tarjeta:
                    datos.tarjeta ?? null
            }
        );
    }


    async enrolarHuella(
        tarea,
        datos
    ) {

        const marca =
            String(
                datos.marca || ""
            ).trim()
            .toLowerCase();

        const ip =
            String(
                datos.ip || ""
            ).trim();

        const puerto =
            Number(
                datos.puerto || 4370
            );

        const idDedo =
            Number(
                datos.iddedo
            );

        if (!marca) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la marca del lector.`
            );
        }

        if (!ip) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la IP del lector.`
            );
        }

        if (!tarea.idempleado) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica el empleado.`
            );
        }

        if (
            !Number.isInteger(idDedo) ||
            idDedo < 0 ||
            idDedo > 9
        ) {

            throw new Error(
                `La tarea #${tarea.idtarea} indica un dedo inválido.`
            );
        }

        if (marca !== "zkteco") {

            throw new Error(
                `La marca "${marca}" todavía no tiene enrolamiento biométrico implementado.`
            );
        }

        console.log(
            "======================================"
        );

        console.log(
            "INICIANDO ENROLAMIENTO DE HUELLA"
        );

        console.log(
            `Empleado / usuario K40: ${tarea.idempleado}`
        );

        console.log(
            `Dedo: ${idDedo}`
        );

        console.log(
            `Lector: ${marca} ${ip}:${puerto}`
        );

        console.log(
            "======================================"
        );

        const enrolamiento =
            new EnrolamientoZKTeco(
                ip,
                puerto
            );

        try {

            const resultado =
                await enrolamiento.enrolarHuella(
                    Number(
                        tarea.idempleado
                    ),
                    idDedo
                );

            /*
             * Buffer no se pierde al convertir
             * la respuesta a JSON.
             *
             * JSON.stringify(Buffer) genera:
             *
             * {
             *     type: "Buffer",
             *     data: [...]
             * }
             *
             * La central podrá recibir posteriormente
             * esos datos para almacenarlos.
             */

            return {
                ok: true,

                idempleado:
                    Number(
                        tarea.idempleado
                    ),

                iddedo:
                    idDedo,

                usuario_lector:
                    resultado.usuario,

                dedo_lector:
                    resultado.dedo,

                valid:
                    resultado.valid,

                size:
                    resultado.size,

                mark:
                    resultado.mark,

                template:
                    resultado.template
            };

        } finally {

            /*
             * El lector se desconecta siempre,
             * tanto si el enrolamiento termina
             * correctamente como si ocurre un error.
             */

            try {

                await enrolamiento.desconectar();

            } catch (error) {

                console.error(
                    "Error desconectando el lector después del enrolamiento:",
                    error.message
                );
            }
        }
    }


    async leerFichadas(
        tarea,
        datos
    ) {

        const marca =
            String(
                datos.marca || ""
            ).trim();

        const ip =
            String(
                datos.ip || ""
            ).trim();

        const puerto =
            Number(
                datos.puerto || 4370
            );

        if (!marca) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la marca del lector.`
            );
        }

        if (!ip) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica la IP del lector.`
            );
        }

        console.log(
            `Leyendo fichadas de ${marca} ${ip}:${puerto}`
        );

        const fichadas =
            await asistenciaService.leerFichadas(
                marca,
                ip,
                puerto
            );

        console.log(
            `Fichadas recibidas del lector: ${fichadas.length}`
        );

        if (
            fichadas.length === 0
        ) {

            return {
                ok: true,
                cantidad: 0,
                mensaje:
                    "El lector no tiene fichadas."
            };
        }

        const fichadasLocal = [];

        for (
            const fichada of fichadas
        ) {

            const deviceUserId =
                String(
                    fichada.deviceUserId || ""
                ).trim();

            if (!deviceUserId) {

                throw new Error(
                    "El lector devolvió una fichada sin deviceUserId."
                );
            }

            const recordTime =
                new Date(
                    fichada.recordTime
                );

            if (
                Number.isNaN(
                    recordTime.getTime()
                )
            ) {

                throw new Error(
                    `Fecha/hora inválida en fichada de ${deviceUserId}.`
                );
            }

            const fecha =
                recordTime
                    .toISOString()
                    .slice(0, 10);

            const hora =
                recordTime
                    .toTimeString()
                    .slice(0, 8);

            fichadasLocal.push({
                deviceUserId,

                idlector:
                    Number(
                        tarea.idlector
                    ),

                fecha,

                hora
            });
        }

        console.log(
            "Guardando fichadas en MariaDB local..."
        );

        const guardadas =
            await db.guardarFichadas(
                fichadasLocal
            );

        console.log(
            `Fichadas guardadas localmente: ${guardadas.length}`
        );

        console.log(
            "MariaDB local confirmó el guardado."
        );

        console.log(
            "Borrando fichadas del ZKTeco..."
        );

        const resultadoBorrado =
            await asistenciaService.borrarFichadas(
                marca,
                ip,
                puerto
            );

        console.log(
            "Fichadas eliminadas del ZKTeco."
        );

        return {
            ok: true,

            cantidad:
                guardadas.length,

            fichadas:
                guardadas,

            borrado_lector:
                true,

            respuesta_lector:
                resultadoBorrado
        };
    }


    async reintentarFichada(
        tarea,
        datos
    ) {

        const idFichada =
            Number(
                datos.idfichada || 0
            );

        if (!idFichada) {

            throw new Error(
                `La tarea #${tarea.idtarea} no indica una fichada válida.`
            );
        }

        console.log(
            `Solicitando reintento de fichada local #${idFichada}...`
        );

        const resultado =
            await db.reintentarFichada(
                idFichada
            );

        if (!resultado) {

            throw new Error(
                `La fichada #${idFichada} no existe o no está en estado error.`
            );
        }

        console.log(
            `Fichada #${idFichada} marcada nuevamente como pendiente.`
        );

        return {
            ok: true,

            idfichada:
                idFichada,

            mensaje:
                "La fichada fue marcada nuevamente como pendiente."
        };
    }


    async enviarResultado(
        idtarea,
        estado,
        respuesta
    ) {

        const apiUrl =
            process.env.API_CENTRAL_URL;

        const agentId =
            process.env.AGENT_ID;

        const token =
            process.env.AGENT_TOKEN;

        if (!apiUrl) {

            throw new Error(
                "Falta API_CENTRAL_URL en .env"
            );
        }

        if (!agentId) {

            throw new Error(
                "Falta AGENT_ID en .env"
            );
        }

        if (!token) {

            throw new Error(
                "Falta AGENT_TOKEN en .env"
            );
        }

        const response =
            await fetch(
                `${apiUrl}/tareas.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        agent_id:
                            agentId,

                        token:
                            token,

                        accion:
                            "resultado",

                        idtarea:
                            idtarea,

                        estado:
                            estado,

                        respuesta:
                            respuesta
                    })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                `Respuesta inválida al informar resultado. HTTP ${response.status}`
            );
        }

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            authService.marcarDesconectado(
                data?.msg ||
                `Error de autenticación. HTTP ${response.status}`
            );
        }

        if (
            !response.ok ||
            data.status !== "ok"
        ) {

            throw new Error(
                data.msg ||
                `Error informando resultado. HTTP ${response.status}`
            );
        }

        agentService.contactoCentral();

        return data;
    }


    async actualizarConfiguracion(
        tarea,
        datos
    ) {

        const apiUrl =
            process.env.API_CENTRAL_URL;

        const agentId =
            process.env.AGENT_ID;

        const token =
            process.env.AGENT_TOKEN;

        if (!apiUrl) {

            throw new Error(
                "Falta API_CENTRAL_URL en .env"
            );
        }

        if (!agentId) {

            throw new Error(
                "Falta AGENT_ID en .env"
            );
        }

        if (!token) {

            throw new Error(
                "Falta AGENT_TOKEN en .env"
            );
        }

        console.log(
            "Consultando configuración central..."
        );

        const response =
            await fetch(
                `${apiUrl}/configuracion.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        agent_id:
                            agentId,

                        token:
                            token
                    })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                `Respuesta inválida al consultar configuración. HTTP ${response.status}`
            );
        }

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            authService.marcarDesconectado(
                data?.msg ||
                `Error de autenticación. HTTP ${response.status}`
            );
        }

        if (
            !response.ok ||
            data.status !== "ok"
        ) {

            throw new Error(
                data.msg ||
                `Error consultando configuración. HTTP ${response.status}`
            );
        }

        const configuracion =
            data.configuracion || {};


        /*
         * Aplicamos la configuración central
         * a los servicios que corresponden.
         *
         * Los valores de la central están expresados
         * en segundos. Cada servicio se encarga de
         * convertirlos a milisegundos.
         */

        authService.aplicarConfiguracion(
            configuracion
        );

        configuracionLectores.aplicarConfiguracion(
            configuracion
        );

        lectorAutomatico.aplicarConfiguracion(
            configuracion
        );


        console.log(
            "Configuración central actualizada."
        );

        console.log(
            "Configuración:",
            configuracion
        );


        return {
            ok: true,

            configuracion:
                configuracion,

            mensaje:
                "Configuración actualizada correctamente."
        };
    }
}


module.exports = new WorkerService();