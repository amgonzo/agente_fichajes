require("dotenv").config();

const db = require("../services/db");

const express = require("express");

const asistenciaService =
    require("../services/asistencia");

const agentService =
    require("../services/agent");

const workerService =
    require("../services/worker");

const sincronizadorService =
    require("../services/sincronizador");

const configuracionLectores =
    require("../services/configuracionLectores");

const lectorAutomaticoService =
    require("../services/lectorAutomatico");

const PORT =
    process.env.PORT || 3000;

const app =
    express();

app.use(
    express.json()
);

// =========================================================
// ESTADO
// =========================================================

app.get(
    "/estado",
    (req, res) => {

        res.json({
            ok: true,

            agent:
                agentService.obtenerEstado()
        });
    }
);

// =========================================================
// ONLINE
// =========================================================

app.post(
    "/online",
    (req, res) => {

        const online =
            agentService.online();

        res.json({
            ok: online,

            agent:
                agentService.obtenerEstado()
        });
    }
);

// =========================================================
// OFFLINE
// =========================================================

app.post(
    "/offline",
    (req, res) => {

        /*
         * IMPORTANTE:
         *
         * Esto solamente modifica el estado
         * informativo del Agent.
         *
         * NO detiene Worker.
         * NO detiene sincronizador.
         */

        agentService.offline();

        res.json({
            ok: true,

            agent:
                agentService.obtenerEstado()
        });
    }
);

// =========================================================
// ACTIVIDAD
// =========================================================

app.post(
    "/actividad",
    (req, res) => {

        agentService.actividad();

        res.json({
            ok: true,

            agent:
                agentService.obtenerEstado()
        });
    }
);

// =========================================================
// SALUD
// =========================================================

app.get(
    "/salud",
    (req, res) => {

        res.json({
            ok: true
        });
    }
);

// =========================================================
// INFORMACIÓN DEL LECTOR
// =========================================================

app.get(
    "/info",
    async (req, res) => {

        try {

            const marca =
                req.query.marca;

            const ip =
                req.query.ip;

            const puerto =
                req.query.puerto;

            if (!marca) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Debe indicar marca"
                });
            }

            if (!ip) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Debe indicar IP"
                });
            }

            const info =
                await asistenciaService.leerInfo(
                    marca,
                    ip,
                    puerto
                );

            res.json({
                ok: true,
                info
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                ok: false,
                error:
                    err.message
            });
        }
    }
);

// =========================================================
// USUARIOS DEL LECTOR
// =========================================================

app.get(
    "/usuarios",
    async (req, res) => {

        try {

            const marca =
                req.query.marca;

            const ip =
                req.query.ip;

            const puerto =
                req.query.puerto;

            if (!marca || !ip) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Debe indicar marca e IP"
                });
            }

            const usuarios =
                await asistenciaService.leerUsuarios(
                    marca,
                    ip,
                    puerto
                );

            res.json({
                ok: true,

                cantidad:
                    usuarios.length,

                usuarios:
                    usuarios
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                ok: false,
                error:
                    err.message
            });
        }
    }
);

// =========================================================
// FICHADAS DIRECTAS DEL LECTOR
// =========================================================

app.get(
    "/fichadas",
    async (req, res) => {

        try {

            const marca =
                req.query.marca;

            const ip =
                req.query.ip;

            const puerto =
                req.query.puerto;

            if (!marca || !ip) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Debe indicar marca e IP"
                });
            }

            const fichadas =
                await asistenciaService.leerFichadas(
                    marca,
                    ip,
                    puerto
                );

            res.json({
                ok: true,

                cantidad:
                    fichadas.length,

                fichadas:
                    fichadas
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                ok: false,
                error:
                    err.message
            });
        }
    }
);

// =========================================================
// INICIAR SERVIDOR
// =========================================================

app.listen(
    PORT,
    async () => {

        console.log(
            `API iniciada en puerto ${PORT}`
        );

        // -------------------------------------------------
        // MARIA DB LOCAL
        // -------------------------------------------------

        try {

            await db.probarConexion();

        } catch (error) {

            console.error(
                "ERROR MariaDB local:"
            );

            console.error(
                error.message
            );
        }

        // -------------------------------------------------
        // AUTENTICACIÓN INICIAL DEL AGENT
        // -------------------------------------------------

        const autenticado =
            await agentService.iniciar();

        if (autenticado) {

            console.log(
                "Autenticación central OK."
            );

        } else {

            console.error(
                "Agent iniciado SIN conexión inicial con la central."
            );

            console.error(
                "Worker y sincronizador continuarán intentando."
            );
        }

        // -------------------------------------------------
        // WORKER
        // -------------------------------------------------

        /*
         * ARRANCA SIEMPRE.
         *
         * No depende de autenticación inicial.
         * No depende de ONLINE/OFFLINE.
         */

        workerService.iniciar();

        // -------------------------------------------------
        // SINCRONIZADOR
        // -------------------------------------------------

        /*
         * ARRANCA SIEMPRE.
         *
         * No depende de autenticación inicial.
         * No depende de ONLINE/OFFLINE.
         */

        sincronizadorService.iniciar();

        // -------------------------------------------------
        // CONFIGURACIÓN DE LECTORES
        // -------------------------------------------------

        await configuracionLectores.iniciar();

        // -------------------------------------------------
        // LECTURA AUTOMATICA DE FICHADAS
        // -------------------------------------------------

        await lectorAutomaticoService.iniciar();
    }
);