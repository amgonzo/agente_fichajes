const authService = require("./auth");

class ConfiguracionLectoresService {

    constructor() {

        this.lectores = [];
        this.ultimaActualizacion = null;
        this.ultimoError = null;
        this.intervalo = null;
        this.actualizando = false;

        this.listeners = [];

        /*
         * Valor local de respaldo.
         *
         * Si la configuración central está disponible,
         * este valor será reemplazado por la central.
         */
        this.intervaloMs = Number(
            process.env.LECTORES_CONFIG_INTERVALO_MS || 60000
        );

        if (
            !Number.isFinite(this.intervaloMs) ||
            this.intervaloMs <= 0
        ) {
            this.intervaloMs = 60000;
        }
    }


    async iniciar() {

        if (this.intervalo) {
            return;
        }

        console.log(
            `Configuración de lectores iniciada. Actualización cada ${this.intervaloMs} ms.`
        );

        await this.actualizar();

        this.intervalo = setInterval(() => {

            this.actualizar();

        }, this.intervaloMs);
    }


    detener() {

        if (this.intervalo) {

            clearInterval(
                this.intervalo
            );

            this.intervalo = null;
        }
    }


    /*
     * Actualiza el intervalo desde la configuración central.
     *
     * La central trabaja en segundos.
     * Este servicio trabaja en milisegundos.
     */
    aplicarConfiguracion(configuracion) {

        if (!configuracion) {
            return;
        }

        const segundos = Number(
            configuracion.lectores_config_intervalo
        );

        if (
            !Number.isFinite(segundos) ||
            segundos <= 0
        ) {
            return;
        }

        const nuevoIntervaloMs =
            segundos * 1000;

        if (
            nuevoIntervaloMs === this.intervaloMs
        ) {
            return;
        }

        this.intervaloMs =
            nuevoIntervaloMs;

        console.log(
            `Nuevo intervalo de configuración de lectores: ${this.intervaloMs} ms.`
        );

        /*
         * Si ya había un intervalo funcionando,
         * lo reiniciamos para aplicar inmediatamente
         * la nueva configuración.
         */
        if (this.intervalo) {

            clearInterval(
                this.intervalo
            );

            this.intervalo = setInterval(() => {

                this.actualizar();

            }, this.intervaloMs);
        }
    }


    suscribirActualizacion(callback) {

        if (typeof callback !== "function") {
            return;
        }

        this.listeners.push(callback);
    }


    notificarActualizacion(lectores) {

        for (const callback of this.listeners) {

            try {

                callback(lectores);

            } catch (error) {

                console.error(
                    "Error al procesar actualización de configuración de lectores."
                );

                console.error(
                    this.obtenerMensajeError(error)
                );
            }
        }
    }


    configuracionCambio(
        lectoresAnteriores,
        lectoresNuevos
    ) {

        const normalizar = (lectores) => {

            return lectores
                .map(lector => ({
                    idlector: Number(lector.idlector),
                    nombre: String(lector.nombre || ""),
                    marca: String(lector.marca || ""),
                    modelo: String(lector.modelo || ""),
                    ip: String(lector.ip || ""),
                    puerto: Number(lector.puerto || 0),
                    ubicacion: String(lector.ubicacion || ""),
                    tipo_uso: String(lector.tipo_uso || ""),
                    predeterminado: Number(lector.predeterminado || 0),
                    activo: Number(lector.activo || 0),
                    idagente: Number(lector.idagente || 0)
                }))
                .sort((a, b) => a.idlector - b.idlector);
        };


        return JSON.stringify(
            normalizar(lectoresAnteriores)
        ) !== JSON.stringify(
            normalizar(lectoresNuevos)
        );
    }


    obtenerMensajeError(error) {

        if (!error) {
            return "Error desconocido.";
        }

        if (typeof error === "string") {
            return error;
        }

        if (error.err?.message) {
            return error.err.message;
        }

        if (error.message) {
            return error.message;
        }

        return String(error);
    }


    async actualizar() {

        if (this.actualizando) {
            return this.lectores;
        }

        this.actualizando = true;

        try {

            const apiUrl = process.env.API_CENTRAL_URL;
            const agentId = process.env.AGENT_ID;
            const token = process.env.AGENT_TOKEN;


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


            const response = await fetch(
                `${apiUrl}/lectores.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        agent_id: agentId,
                        token
                    })
                }
            );


            let data;

            try {

                data = await response.json();

            } catch (error) {

                throw new Error(
                    `Respuesta inválida de la central. HTTP ${response.status}`
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
                    data?.msg ||
                    `Error obteniendo configuración de lectores. HTTP ${response.status}`
                );
            }


            if (!Array.isArray(data.lectores)) {

                throw new Error(
                    "La central no devolvió una lista válida de lectores."
                );
            }


            const lectoresAnteriores =
                this.lectores;


            const lectoresNuevos =
                data.lectores;


            const huboCambio =
                this.configuracionCambio(
                    lectoresAnteriores,
                    lectoresNuevos
                );


            this.lectores =
                lectoresNuevos;


            this.ultimaActualizacion =
                new Date();


            this.ultimoError =
                null;


            console.log(
                `Configuración de lectores actualizada: ${this.lectores.length} lector(es).`
            );


            if (
                lectoresAnteriores.length > 0 &&
                huboCambio
            ) {

                console.log(
                    "Cambio detectado en la configuración de lectores."
                );

                console.log(
                    "Se solicitará una lectura inmediata."
                );

                this.notificarActualizacion(
                    this.lectores
                );
            }


            return this.lectores;

        } catch (error) {

            this.ultimoError =
                this.obtenerMensajeError(error);


            console.error(
                "No se pudo actualizar la configuración de lectores:"
            );


            console.error(
                this.ultimoError
            );


            return this.lectores;

        } finally {

            this.actualizando = false;
        }
    }


    obtenerLectores() {

        return this.lectores;
    }


    obtenerEstado() {

        return {
            cantidad: this.lectores.length,

            ultimaActualizacion:
                this.ultimaActualizacion,

            ultimoError:
                this.ultimoError,

            lectores:
                this.lectores
        };
    }
}


module.exports =
    new ConfiguracionLectoresService();