const authService = require("./auth");

class AgentService {

    constructor() {

        this.estado = "INICIANDO";

        this.ultimaActividad = null;
        this.ultimoContactoCentral = null;
        this.ultimoError = null;
    }

    async iniciar() {

        this.estado = "INICIANDO";

        try {

            await authService.autenticar();

            this.estado = "ACTIVO";
            this.ultimaActividad = new Date();
            this.ultimoContactoCentral = new Date();
            this.ultimoError = null;

            console.log(
                "Agent iniciado correctamente."
            );

            return true;

        } catch (error) {

            this.estado = "SIN_CONEXION";
            this.ultimoError = error.message;

            console.error(
                "No se pudo autenticar el Agent:"
            );

            console.error(
                error.message
            );

            /*
             * IMPORTANTE:
             *
             * Esto NO detiene Worker ni sincronizador.
             *
             * Ambos seguirán funcionando y volverán
             * a intentar comunicarse con la central.
             */

            return false;
        }
    }

    online() {

        /*
         * Se conserva por compatibilidad con la API
         * local, pero ya NO controla Worker ni sincronizador.
         */

        if (this.estado === "OFFLINE") {
            this.estado = "ACTIVO";
        }

        this.actividad();

        console.log(
            "Agent marcado como ACTIVO."
        );

        return true;
    }

    offline() {

        /*
         * IMPORTANTE:
         *
         * Esto solamente cambia el estado informado
         * por /estado.
         *
         * NO detiene Worker.
         * NO detiene sincronizador.
         */

        this.estado = "OFFLINE";

        console.log(
            "Agent marcado como OFFLINE."
        );
    }

    actividad() {

        this.ultimaActividad = new Date();
    }

    contactoCentral() {

        this.ultimoContactoCentral = new Date();
        this.ultimoError = null;

        if (this.estado === "SIN_CONEXION") {
            this.estado = "ACTIVO";
        }
    }

    errorCentral(error) {

        this.ultimoError =
            error?.message ||
            String(error);

        if (
            this.estado !== "OFFLINE"
        ) {
            this.estado = "SIN_CONEXION";
        }
    }

    estaOnline() {

        /*
         * Se mantiene solamente por compatibilidad
         * con código existente.
         *
         * NO debe utilizarse para bloquear tareas.
         */

        return (
            this.estado === "ACTIVO"
        );
    }

    obtenerEstado() {

        return {

            estado: this.estado,

            /*
             * Se mantiene por compatibilidad.
             */
            online: this.estaOnline(),

            autenticado:
                authService.estaAutenticado(),

            agente:
                authService.obtenerAgente(),

            ultimaActividad:
                this.ultimaActividad,

            ultimoContactoCentral:
                this.ultimoContactoCentral,

            ultimoError:
                this.ultimoError
        };
    }
}

module.exports = new AgentService();