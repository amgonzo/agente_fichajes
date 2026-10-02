const configuracionLectores =
    require("./configuracionLectores");

const asistenciaService =
    require("./asistencia");

const db =
    require("./db");

const agentService =
    require("./agent");

const incidenciasService =
    require("./incidencias");

const net = require("net");

class LectorAutomaticoService {

    constructor() {

        this.intervalo = null;

        this.ejecutando = false;

        /*
         * Valor local de respaldo.
         *
         * Si la configuración central está disponible,
         * será reemplazado por la configuración central.
         */
        this.intervaloMs = Number(
            process.env.LECTORES_LECTURA_INTERVALO_MS || 300000
        );

        if (
            !Number.isFinite(this.intervaloMs) ||
            this.intervaloMs <= 0
        ) {
            this.intervaloMs = 300000;
        }
    }


    async iniciar() {

        if (this.intervalo) {
            return;
        }


        console.log(
            `Lector automático iniciado. Lectura cada ${this.intervaloMs} ms.`
        );


        /*
         * Si la configuración de lectores cambia,
         * hacemos una lectura inmediatamente.
         */
        configuracionLectores.suscribirActualizacion(
            () => {

                console.log(
                    "Lector automático: configuración modificada. Ejecutando lectura inmediata."
                );

                this.leerTodos().catch(error => {

                    console.error(
                        "Error durante la lectura automática:"
                    );

                    console.error(
                        this.obtenerMensajeError(error)
                    );
                });
            }
        );


        /*
         * Primera lectura.
         */
        await this.leerTodos();


        /*
         * Lecturas periódicas.
         */
        this.intervalo =
            setInterval(() => {

                this.leerTodos().catch(error => {

                    console.error(
                        "Error durante la lectura automática:"
                    );

                    console.error(
                        this.obtenerMensajeError(error)
                    );
                });

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
            "Lector automático detenido."
        );
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
            configuracion.lectores_lectura_intervalo
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
            `Nuevo intervalo de lectura automática: ${this.intervaloMs} ms.`
        );

        /*
         * Si el servicio ya estaba funcionando,
         * reiniciamos el intervalo para aplicar
         * inmediatamente la nueva configuración.
         */
        if (this.intervalo) {

            clearInterval(
                this.intervalo
            );

            this.intervalo =
                setInterval(() => {

                    this.leerTodos().catch(error => {

                        console.error(
                            "Error durante la lectura automática:"
                        );

                        console.error(
                            this.obtenerMensajeError(error)
                        );
                    });

                }, this.intervaloMs);
        }
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


    obtenerCodigoIncidencia(lector) {

        return `LECTOR_NO_RESPONDE_${Number(lector.idlector)}`;
    }


    obtenerMensajeLector(
        lector,
        error
    ) {

        const detalle =
            this.obtenerMensajeError(error);


        const ip =
            String(lector.ip || "").trim();


        const puerto =
            Number(lector.puerto || 4370);


        /*
         * Errores típicos de conexión.
         */
        const errorConexion =
            /socket|connect|connection|timeout|timed out|refused|econn|enotfound|network/i
                .test(detalle);


        if (errorConexion) {

            return (
                `El reloj "${lector.nombre}" no responde ` +
                `(${ip}:${puerto}). ` +
                `Verifique que esté encendido, conectado a la red ` +
                `y que la IP y el puerto sean correctos.`
            );
        }


        return (
            `Error leyendo el reloj "${lector.nombre}" ` +
            `(${ip}:${puerto}): ${detalle}`
        );
    }


    async informarFallaLector(
        lector,
        error
    ) {

        const codigo =
            this.obtenerCodigoIncidencia(
                lector
            );


        const mensaje =
            this.obtenerMensajeLector(
                lector,
                error
            );


        const detalle =
            this.obtenerMensajeError(
                error
            );


        const contexto = {

            idlector:
                Number(lector.idlector),

            nombre:
                lector.nombre || null,

            marca:
                lector.marca || null,

            modelo:
                lector.modelo || null,

            ip:
                lector.ip || null,

            puerto:
                Number(lector.puerto || 4370),

            ubicacion:
                lector.ubicacion || null,

            tipo_uso:
                lector.tipo_uso || null
        };


        await incidenciasService.informar({

            tipo: "lector",

            codigo,

            severidad: "error",

            mensaje,

            detalle,

            contexto,

            idlector:
                Number(lector.idlector)
        });
    }


    async informarRecuperacionLector(
        lector
    ) {

        const codigo =
            this.obtenerCodigoIncidencia(
                lector
            );


        await incidenciasService.recuperar({

            codigo,

            resolucion:
                `El reloj "${lector.nombre}" volvió a responder correctamente.`
        });
    }


    async leerTodos() {

        if (this.ejecutando) {

            console.log(
                "Lector automático: ya hay una lectura en ejecución."
            );

            return;
        }


        this.ejecutando = true;


        try {

            const lectores =
                configuracionLectores.obtenerLectores();


            if (
                !Array.isArray(lectores) ||
                lectores.length === 0
            ) {

                console.log(
                    "Lector automático: no hay lectores configurados."
                );

                return;
            }


            console.log(
                `Lector automático: iniciando lectura de ${lectores.length} lector(es).`
            );


            for (
                const lector of lectores
            ) {

                try {

                    await this.leerLector(
                        lector
                    );


                    /*
                     * Si llegó hasta acá, el reloj respondió
                     * correctamente.
                     *
                     * Si existía una incidencia abierta por
                     * falta de respuesta, la recuperamos.
                     */
                    await this.informarRecuperacionLector(
                        lector
                    );


                } catch (error) {

                    const mensaje =
                        this.obtenerMensajeLector(
                            lector,
                            error
                        );


                    console.error(
                        `Lector #${lector.idlector}: ${mensaje}`
                    );


                    /*
                     * Informamos la falla a la central,
                     * pero NO detenemos los demás lectores.
                     */
                    try {

                        await this.informarFallaLector(
                            lector,
                            error
                        );

                    } catch (incidenciaError) {

                        console.error(
                            `No se pudo informar la incidencia del lector #${lector.idlector}:`
                        );

                        console.error(
                            this.obtenerMensajeError(
                                incidenciaError
                            )
                        );
                    }
                }
            }

        } finally {

            this.ejecutando = false;
        }
    }


    async comprobarConexionLector(ip, puerto, intentos = 3) {

        for (let intento = 1; intento <= intentos; intento++) {

            const conectado = await new Promise((resolve) => {

                const socket = new net.Socket();

                let terminado = false;

                const finalizar = (resultado) => {

                    if (terminado) {
                        return;
                    }

                    terminado = true;

                    try {
                        socket.destroy();
                    } catch (error) {}

                    resolve(resultado);
                };


                socket.setTimeout(1500);


                socket.once("connect", () => {

                    finalizar(true);

                });


                socket.once("timeout", () => {

                    finalizar(false);

                });


                socket.once("error", () => {

                    finalizar(false);

                });


                try {

                    socket.connect(
                        Number(puerto),
                        ip
                    );

                } catch (error) {

                    finalizar(false);
                }
            });


            if (conectado) {

                agentService.actividad();

                return true;
            }


            if (intento < intentos) {

                await new Promise(
                    resolve => setTimeout(resolve, 300)
                );
            }
        }


        return false;
    }


    async leerLector(lector) {

        const idLector =
            Number(
                lector.idlector
            );


        const marca =
            String(
                lector.marca || ""
            ).trim();


        const ip =
            String(
                lector.ip || ""
            ).trim();


        const puerto =
            Number(
                lector.puerto || 4370
            );


        if (!idLector) {

            throw new Error(
                "El lector no tiene un idlector válido."
            );
        }


        if (!marca) {

            throw new Error(
                `El lector #${idLector} no tiene marca configurada.`
            );
        }


        if (!ip) {

            throw new Error(
                `El lector #${idLector} no tiene IP configurada.`
            );
        }


        console.log(
            `Leyendo fichadas de lector #${idLector} ${lector.nombre || ""} (${marca} ${ip}:${puerto})`
        );


        console.log(
            `Comprobando conexión con lector #${idLector} (${ip}:${puerto})...`
        );


        const disponible =
            await this.comprobarConexionLector(
                ip,
                puerto,
                3
            );


        if (!disponible) {

            throw new Error(
                `El reloj "${lector.nombre}" no responde en ${ip}:${puerto} después de 3 intentos.`
            );
        }


        console.log(
            `Lector #${idLector}: conexión disponible. Iniciando lectura de fichadas.`
        );


        const fichadas =
            await asistenciaService.leerFichadas(
                marca,
                ip,
                puerto
            );


        if (
            !Array.isArray(fichadas)
        ) {

            throw new Error(
                `El lector #${idLector} no devolvió una lista válida de fichadas.`
            );
        }


        console.log(
            `Lector #${idLector}: ${fichadas.length} fichada(s) recibida(s).`
        );


        if (
            fichadas.length === 0
        ) {

            return {
                ok: true,
                cantidad: 0
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
                    `El lector #${idLector} devolvió una fichada sin deviceUserId.`
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
                    idLector,

                fecha,

                hora
            });
        }


        console.log(
            `Guardando ${fichadasLocal.length} fichada(s) del lector #${idLector} en MariaDB local...`
        );


        const guardadas =
            await db.guardarFichadas(
                fichadasLocal
            );


        console.log(
            `Lector #${idLector}: ${guardadas.length} fichada(s) guardada(s) localmente.`
        );


        console.log(
            `Borrando fichadas del lector #${idLector}...`
        );


        const resultadoBorrado =
            await asistenciaService.borrarFichadas(
                marca,
                ip,
                puerto
            );


        console.log(
            `Lector #${idLector}: fichadas eliminadas correctamente del reloj.`
        );


        agentService.actividad();


        return {

            ok: true,

            idlector:
                idLector,

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
}


module.exports = new LectorAutomaticoService();