const authService = require("./auth");

class IncidenciasService {

    async informar({
        tipo,
        codigo,
        severidad = "error",
        mensaje,
        detalle = null,
        contexto = null,
        idlector = null
    }) {

        if (!authService.estaAutenticado()) {
            console.error(
                "No se puede registrar incidencia: Agent no autenticado."
            );
            return false;
        }

        const apiUrl = process.env.API_CENTRAL_URL;
        const agentId = process.env.AGENT_ID;
        const token = process.env.AGENT_TOKEN;

        if (!apiUrl) {
            console.error(
                "No se puede registrar incidencia: falta API_CENTRAL_URL."
            );
            return false;
        }

        if (!agentId) {
            console.error(
                "No se puede registrar incidencia: falta AGENT_ID."
            );
            return false;
        }

        if (!token) {
            console.error(
                "No se puede registrar incidencia: falta AGENT_TOKEN."
            );
            return false;
        }

        try {

            const response = await fetch(
                `${apiUrl}/incidencias.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        accion: "informar",

                        agent_id: agentId,
                        token: token,

                        tipo,
                        codigo,
                        severidad,
                        mensaje,
                        detalle,
                        contexto,
                        idlector
                    })
                }
            );

            let data;

            try {
                data = await response.json();
            } catch (error) {

                throw new Error(
                    `Respuesta inválida de la API de incidencias. HTTP ${response.status}`
                );
            }

            if (!response.ok || data.status !== "ok") {

                throw new Error(
                    data.msg ||
                    `Error registrando incidencia. HTTP ${response.status}`
                );
            }

            console.log(
                `Incidencia registrada: ${codigo} (#${data.idincidencia})`
            );

            return data;

        } catch (error) {

            console.error(
                "No se pudo registrar la incidencia:"
            );

            console.error(
                error?.message || error
            );

            return false;
        }
    }


    async recuperar({
        codigo,
        resolucion = "El problema se recuperó automáticamente."
    }) {

        if (!authService.estaAutenticado()) {
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
                `${apiUrl}/incidencias.php`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        accion: "recuperar",

                        agent_id: agentId,
                        token: token,

                        codigo,
                        resolucion
                    })
                }
            );

            let data;

            try {
                data = await response.json();
            } catch (error) {
                throw new Error(
                    `Respuesta inválida de la API de incidencias. HTTP ${response.status}`
                );
            }

            if (!response.ok || data.status !== "ok") {
                throw new Error(
                    data.msg ||
                    `Error recuperando incidencia. HTTP ${response.status}`
                );
            }

            if (Number(data.cantidad || 0) > 0) {

                console.log(
                    `Incidencia recuperada: ${codigo}`
                );
            }

            return data;

        } catch (error) {

            console.error(
                "No se pudo registrar la recuperación de la incidencia:"
            );

            console.error(
                error?.message || error
            );

            return false;
        }
    }
}


module.exports = new IncidenciasService();