class AuthService {

    constructor() {

        this.autenticado = false;
        this.agente = null;

        this.ultimaAutenticacion = null;
        this.ultimoHeartbeat = null;
        this.ultimoError = null;

        this.autenticando = false;
        this.heartbeatIntervalo = null;

        /*
         * Valor local de respaldo.
         *
         * Si la configuración central está disponible,
         * será reemplazado por la configuración central.
         */
        this.heartbeatMs = Number(
            process.env.AGENT_HEARTBEAT_INTERVALO_MS || 30000
        );

        if (
            !Number.isFinite(this.heartbeatMs) ||
            this.heartbeatMs <= 0
        ) {
            this.heartbeatMs = 30000;
        }
    }


    async autenticar() {

        if (this.autenticando) {
            return this.agente;
        }

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

        this.autenticando = true;

        try {

            const response = await fetch(
                `${apiUrl}/auth.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        agent_id: agentId,
                        token: token
                    })
                }
            );

            let data;

            try {

                data = await response.json();

            } catch (err) {

                throw new Error(
                    `Respuesta inválida del servidor central. HTTP ${response.status}`
                );
            }

            if (
                !response.ok ||
                data.status !== "ok"
            ) {

                throw new Error(
                    data.msg ||
                    `Error de autenticación. HTTP ${response.status}`
                );
            }

            this.autenticado = true;
            this.agente = data.agente;
            this.ultimaAutenticacion = new Date();
            this.ultimoHeartbeat = new Date();
            this.ultimoError = null;

            console.log(
                `Agente autenticado: ${this.agente.nombre}`
            );

            console.log(
                `Agent ID: ${this.agente.agent_id}`
            );

            console.log(
                `Empresa ID: ${this.agente.idempresa}`
            );

            this.iniciarHeartbeat();

            return this.agente;

        } catch (error) {

            this.autenticado = false;
            this.agente = null;
            this.ultimoError = error.message;

            throw error;

        } finally {

            this.autenticando = false;
        }
    }


    /*
     * Aplica la configuración recibida desde la central.
     *
     * La central trabaja en segundos.
     * Este servicio trabaja en milisegundos.
     */
    aplicarConfiguracion(configuracion) {

        if (!configuracion) {
            return;
        }

        const segundos = Number(
            configuracion.agent_heartbeat_intervalo
        );

        if (
            !Number.isFinite(segundos) ||
            segundos <= 0
        ) {
            return;
        }

        const nuevoHeartbeatMs =
            segundos * 1000;

        if (
            nuevoHeartbeatMs === this.heartbeatMs
        ) {
            return;
        }

        this.heartbeatMs =
            nuevoHeartbeatMs;

        console.log(
            `Nuevo intervalo de heartbeat: ${this.heartbeatMs} ms.`
        );

        /*
         * Si el heartbeat ya estaba funcionando,
         * reiniciamos el intervalo para aplicar
         * inmediatamente la nueva configuración.
         */
        if (this.heartbeatIntervalo) {

            this.detenerHeartbeat();

            this.iniciarHeartbeat();
        }
    }


    iniciarHeartbeat() {

        if (this.heartbeatIntervalo) {
            return;
        }

        console.log(
            `Heartbeat del Agent iniciado. Intervalo: ${this.heartbeatMs} ms.`
        );

        this.heartbeatIntervalo = setInterval(
            () => {
                this.enviarHeartbeat();
            },
            this.heartbeatMs
        );
    }


    detenerHeartbeat() {

        if (this.heartbeatIntervalo) {

            clearInterval(
                this.heartbeatIntervalo
            );

            this.heartbeatIntervalo = null;
        }
    }


    async enviarHeartbeat() {

        if (!this.autenticado) {
            return false;
        }

        const apiUrl = process.env.API_CENTRAL_URL;
        const agentId = process.env.AGENT_ID;
        const token = process.env.AGENT_TOKEN;

        if (!apiUrl || !agentId || !token) {
            return false;
        }

        try {

            const response = await fetch(
                `${apiUrl}/auth.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        accion: "heartbeat",
                        agent_id: agentId,
                        token: token
                    })
                }
            );

            let data;

            try {

                data = await response.json();

            } catch (error) {

                throw new Error(
                    `Respuesta inválida del heartbeat. HTTP ${response.status}`
                );
            }

            if (
                !response.ok ||
                data.status !== "ok"
            ) {

                throw new Error(
                    data.msg ||
                    `Error de heartbeat. HTTP ${response.status}`
                );
            }

            this.ultimoHeartbeat = new Date();
            this.ultimoError = null;

            return true;

        } catch (error) {

            this.ultimoError =
                error?.message ||
                String(error);

            console.error(
                "Heartbeat del Agent falló:"
            );

            console.error(
                this.ultimoError
            );

            if (
                error?.message &&
                /desactivado|inválid|invalido|credenciales|token/i
                    .test(error.message)
            ) {

                this.marcarDesconectado(
                    error.message
                );
            }

            return false;
        }
    }


    estaAutenticado() {

        return this.autenticado;
    }


    obtenerAgente() {

        return this.agente;
    }


    obtenerEstado() {

        return {
            autenticado:
                this.autenticado,

            agente:
                this.agente,

            ultimaAutenticacion:
                this.ultimaAutenticacion,

            ultimoHeartbeat:
                this.ultimoHeartbeat,

            ultimoError:
                this.ultimoError
        };
    }


    marcarDesconectado(mensaje = null) {

        this.autenticado = false;

        if (mensaje) {
            this.ultimoError = mensaje;
        }
    }


    cerrarSesion() {

        this.detenerHeartbeat();

        this.autenticado = false;
        this.agente = null;
        this.ultimaAutenticacion = null;
        this.ultimoHeartbeat = null;
    }
}


module.exports = new AuthService();