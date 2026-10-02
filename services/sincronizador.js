const db = require("./db");
const authService = require("./auth");
const agentService = require("./agent");
const incidenciasService = require("./incidencias");

class SincronizadorService {

    constructor() {

        this.intervalo = null;
        this.ejecutando = false;

        this.intervaloMs = 30000;
    }

    iniciar() {

        if (this.intervalo) {
            return;
        }

        console.log(
            "Sincronizador de fichadas iniciado."
        );

        this.sincronizar();

        this.intervalo =
            setInterval(() => {

                this.sincronizar();

            }, this.intervaloMs);
    }

    detener() {

        if (this.intervalo) {

            clearInterval(
                this.intervalo
            );

            this.intervalo = null;
        }

        console.log(
            "Sincronizador de fichadas detenido."
        );
    }

    async sincronizar() {

        if (this.ejecutando) {
            return;
        }

        this.ejecutando = true;

        try {

            const pendientes =
                await db.obtenerFichadasPendientes(
                    50
                );

            if (
                !pendientes ||
                pendientes.length === 0
            ) {

                return;
            }

            console.log(
                `Fichadas pendientes para sincronizar: ${pendientes.length}`
            );

            const fichadas =
                pendientes.map(
                    fichada => ({
                        idfichada:
                            Number(
                                fichada.idfichada
                            ),

                        deviceUserId:
                            String(
                                fichada.device_user_id
                            ),

                        idlector:
                            Number(
                                fichada.idlector
                            ),

                        fecha:
                            this.formatearFecha(
                                fichada.fecha
                            ),

                        hora:
                            this.formatearHora(
                                fichada.hora
                            )
                    })
                );

            const resultado =
                await this.enviar(
                    fichadas
                );

            if (
                !resultado ||
                resultado.status !== "ok"
            ) {

                throw new Error(
                    resultado?.msg ||
                    "La API central rechazó las fichadas."
                );
            }

            const confirmadas =
                Array.isArray(
                    resultado.confirmadas
                )
                    ? resultado.confirmadas
                    : [];

            const errores =
                Array.isArray(
                    resultado.errores
                )
                    ? resultado.errores
                    : [];


            // =================================================
            // CONFIRMADAS
            // =================================================

            if (
                confirmadas.length > 0
            ) {

                const idsConfirmadas =
                    confirmadas
                        .map(
                            item =>
                                Number(
                                    item.idfichada
                                )
                        )
                        .filter(
                            id => id > 0
                        );

                const actualizadas =
                    await db.marcarFichadasConfirmadas(
                        idsConfirmadas
                    );

                console.log(
                    `Fichadas confirmadas localmente: ${actualizadas}`
                );


                // =================================================
                // RECUPERAR INCIDENCIAS DE FICHADAS QUE TENÍAN ERROR
                //
                // Importante:
                // obtenerFichadasPendientes() devuelve pendientes,
                // por lo que NO debemos comprobar estado === "error".
                //
                // reintentarFichada() conserva ultimo_error justamente
                // para poder identificar que esa fichada provenía de
                // una incidencia.
                // =================================================

                for (
                    const item of confirmadas
                ) {

                    const idfichada =
                        Number(
                            item.idfichada
                        );

                    if (!idfichada) {
                        continue;
                    }

                    const fichadaOriginal =
                        pendientes.find(
                            ficha =>
                                Number(
                                    ficha.idfichada
                                ) === idfichada
                        );

                    if (!fichadaOriginal) {
                        continue;
                    }

                    const ultimoError =
                        String(
                            fichadaOriginal.ultimo_error || ""
                        ).trim();

                    /*
                     * Si no tenía un error anterior,
                     * es una fichada normal y no hay
                     * incidencia que recuperar.
                     */
                    if (ultimoError === "") {
                        continue;
                    }

                    let codigo =
                        "FICHADA_ERROR";

                    if (
                        ultimoError.includes(
                            "No existe empleado"
                        )
                    ) {

                        const deviceUserId =
                            String(
                                fichadaOriginal.device_user_id || ""
                            ).trim();

                        codigo =
                            deviceUserId !== ""
                                ? `FICHADA_EMPLEADO_NO_EXISTE:${deviceUserId}`
                                : "FICHADA_EMPLEADO_NO_EXISTE";
                    }

                    const recuperacion =
                        await incidenciasService.recuperar({

                            codigo,

                            resolucion:
                                "La fichada fue procesada correctamente por la central."
                        });

                    if (recuperacion) {

                        console.log(
                            `Incidencia recuperada para fichada #${idfichada}: ${codigo}`
                        );
                    }
                }
            }


            // =================================================
            // ERRORES DE NEGOCIO
            // =================================================

            if (
                errores.length > 0
            ) {

                for (
                    const errorFichada of errores
                ) {

                    const idfichada =
                        Number(
                            errorFichada.idfichada
                        );

                    if (!idfichada) {
                        continue;
                    }

                    const mensaje =
                        errorFichada.error ||
                        "Error informado por la API central.";

                    await db.marcarFichadaError(
                        idfichada,
                        mensaje
                    );

                    console.error(
                        `Fichada #${idfichada} con error: ${mensaje}`
                    );

                    let codigo =
                        "FICHADA_ERROR";

                    if (
                        mensaje.includes(
                            "No existe empleado"
                        )
                    ) {

                        const deviceUserId =
                            String(
                                errorFichada.deviceUserId ||
                                ""
                            ).trim();

                        codigo =
                            deviceUserId !== ""
                                ? `FICHADA_EMPLEADO_NO_EXISTE:${deviceUserId}`
                                : "FICHADA_EMPLEADO_NO_EXISTE";
                    }

                    const severidad =
                        mensaje.includes(
                            "No existe empleado"
                        )
                            ? "advertencia"
                            : "error";

                    await incidenciasService.informar({

                        tipo:
                            "fichada",

                        codigo:
                            codigo,

                        severidad:
                            severidad,

                        mensaje:
                            mensaje,

                        detalle:
                            mensaje,

                        contexto: {

                            idfichada:
                                idfichada,

                            deviceUserId:
                                errorFichada.deviceUserId ||
                                null,

                            idlector:
                                errorFichada.idlector ||
                                null,

                            fecha:
                                errorFichada.fecha ||
                                null,

                            hora:
                                errorFichada.hora ||
                                null
                        },

                        idlector:
                            errorFichada.idlector
                                ? Number(
                                    errorFichada.idlector
                                )
                                : null
                    });
                }

                console.error(
                    `Fichadas con error: ${errores.length}`
                );
            }


            console.log(
                `Fichadas insertadas en central: ${
                    Number(
                        resultado.insertadas || 0
                    )
                }`
            );

            console.log(
                `Fichadas que ya existían en central: ${
                    Number(
                        resultado.ya_existian || 0
                    )
                }`
            );

            agentService.contactoCentral();
            agentService.actividad();

        } catch (error) {

            /*
             * Si la central está caída:
             *
             * pendiente -> pendiente
             *
             * No convertir en error.
             */

            agentService.errorCentral(
                error
            );

            console.error(
                "Error sincronizando fichadas:"
            );

            console.error(
                error?.message ||
                error
            );

        } finally {

            this.ejecutando = false;
        }
    }

    formatearFecha(valor) {

        if (
            valor instanceof Date
        ) {

            return valor
                .toISOString()
                .slice(0, 10);
        }

        const texto =
            String(valor);

        if (
            /^\d{4}-\d{2}-\d{2}$/.test(
                texto
            )
        ) {

            return texto;
        }

        if (
            texto.length >= 10
        ) {

            return texto.slice(
                0,
                10
            );
        }

        throw new Error(
            `Fecha inválida: ${texto}`
        );
    }

    formatearHora(valor) {

        if (
            valor instanceof Date
        ) {

            return valor
                .toTimeString()
                .slice(0, 8);
        }

        const texto =
            String(valor);

        if (
            /^\d{2}:\d{2}:\d{2}$/.test(
                texto
            )
        ) {

            return texto;
        }

        if (
            /^\d{2}:\d{2}$/.test(
                texto
            )
        ) {

            return `${texto}:00`;
        }

        throw new Error(
            `Hora inválida: ${texto}`
        );
    }

    async enviar(
        fichadas
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
                `${apiUrl}/fichadas.php`,
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

                        fichadas:
                            fichadas
                    })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                `Respuesta inválida de la API central. HTTP ${response.status}`
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

        if (!response.ok) {

            throw new Error(
                data?.msg ||
                `Error HTTP ${response.status}`
            );
        }

        agentService.contactoCentral();

        return data;
    }
}


module.exports = new SincronizadorService();