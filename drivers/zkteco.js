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


    async cargarEmpleado(empleado, uidK40 = null) {

        if (
            !empleado ||
            typeof empleado !== "object"
        ) {

            throw new Error(
                "Datos de empleado inválidos."
            );
        }


        const idempleado =
            Number(
                empleado.idempleado
            );


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


        /*
         * Si el empleado ya existe en el K40,
         * usamos el UID que ya tiene el reloj.
         *
         * Si es nuevo, usamos idempleado
         * como UID inicial.
         */
        const uid =
            uidK40 !== null
                ? Number(uidK40)
                : idempleado;


        if (
            !Number.isInteger(uid) ||
            uid <= 0
        ) {

            throw new Error(
                "UID interno del K40 inválido."
            );
        }


        console.log(
            `Cargando empleado ${idempleado} / ${documento} - ${nombreCompleto} - UID K40=${uid}`
        );


        /*
         * primer parámetro = UID interno del K40
         * segundo parámetro = USERID lógico
         *
         * USERID = documento.
         */
        const resultado =
            await this.zk.setUser(
                uid,
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
                    tarjeta || null,

                uid: uid

            }

        };
    }


    async sincronizarEmpleados(empleados) {

        if (!Array.isArray(empleados)) {

            throw new Error(
                "La lista de empleados no es válida."
            );
        }


        console.log(
            "======================================"
        );

        console.log(
            "SINCRONIZANDO EMPLEADOS EN ZKTECO"
        );

        console.log(
            `Empleados a sincronizar: ${empleados.length}`
        );

        console.log(
            "======================================"
        );


        /*
         * =====================================================
         * 1. CONSULTAR INFORMACIÓN DEL K40
         * =====================================================
         *
         * IMPORTANTE:
         *
         * No usamos getUsers() si el reloj informa
         * que tiene cero usuarios.
         *
         * Esto evita el problema específico del K40
         * vacío que estamos viendo.
         */
        console.log(
            "Consultando cantidad de usuarios del K40..."
        );


        const info =
            await this.zk.getInfo();


        const cantidadUsuarios =
            Number(
                info?.userCounts || 0
            );


        console.log(
            `Usuarios informados por el K40: ${cantidadUsuarios}`
        );


        /*
         * =====================================================
         * CASO 1: K40 VACÍO
         * =====================================================
         */
        if (cantidadUsuarios === 0) {

            console.log(
                "El K40 está vacío."
            );

            console.log(
                "No se ejecutará getUsers()."
            );

            console.log(
                "Cargando directamente los empleados..."
            );


            let cargados = 0;

            const errores = [];


            for (
                const empleado of empleados
            ) {

                try {

                    const resultado =
                        await this.cargarEmpleado(
                            empleado
                        );


                    if (
                        resultado?.ok
                    ) {

                        cargados++;
                    }

                } catch (error) {

                    const mensaje =
                        error?.err?.message ||
                        error?.message ||
                        String(error);


                    console.error(
                        `Error cargando empleado ${empleado?.idempleado}:`,
                        mensaje
                    );


                    errores.push({

                        idempleado:
                            empleado?.idempleado ?? null,

                        documento:
                            empleado?.documento ?? null,

                        error:
                            mensaje

                    });
                }
            }


            console.log(
                "======================================"
            );

            console.log(
                "SINCRONIZACIÓN FINALIZADA"
            );

            console.log(
                "Reloj estaba vacío."
            );

            console.log(
                `Eliminados: 0`
            );

            console.log(
                `Cargados: ${cargados}`
            );

            console.log(
                `Errores: ${errores.length}`
            );

            console.log(
                "======================================"
            );


            return {

                ok:
                    errores.length === 0,

                eliminados: 0,

                cargados,

                errores,

                empleados:
                    empleados.filter(
                        (empleado) => {

                            return errores.find(
                                error =>
                                    Number(
                                        error.idempleado
                                    ) ===
                                    Number(
                                        empleado.idempleado
                                    )
                            ) === undefined;
                        }
                    )

            };
        }


        /*
         * =====================================================
         * CASO 2: EL K40 YA TIENE USUARIOS
         * =====================================================
         *
         * Recién acá utilizamos getUsers().
         */
        console.log(
            "El K40 tiene usuarios."
        );

        console.log(
            "Leyendo usuarios actuales del K40..."
        );


        const resultadoUsuarios =
            await this.zk.getUsers();


        const usuariosActuales =
            resultadoUsuarios.data || [];


        console.log(
            `Usuarios obtenidos del K40: ${usuariosActuales.length}`
        );


        /*
         * =====================================================
         * 2. ARMAR MAPA DE EMPLEADOS DE LA BASE
         * =====================================================
         *
         * La identidad del empleado en el K40
         * es el documento, almacenado como userId.
         */
        const empleadosPorDocumento =
            new Map();


        for (
            const empleado of empleados
        ) {

            const documento =
                String(
                    empleado?.documento || ""
                ).trim();


            if (!documento) {

                console.warn(
                    "Empleado sin documento, se omite:",
                    empleado
                );

                continue;
            }


            empleadosPorDocumento.set(
                documento,
                empleado
            );
        }


        /*
         * =====================================================
         * 3. ARMAR MAPA DE USUARIOS DEL K40
         * =====================================================
         */
        const usuariosPorDocumento =
            new Map();


        for (
            const usuario of usuariosActuales
        ) {

            const documento =
                String(
                    usuario?.userId || ""
                ).trim();


            if (!documento) {

                console.warn(
                    "Usuario del K40 sin USERID:",
                    usuario
                );

                continue;
            }


            usuariosPorDocumento.set(
                documento,
                usuario
            );
        }


        /*
         * =====================================================
         * 4. ELIMINAR USUARIOS QUE YA NO EXISTEN EN BD
         * =====================================================
         */
        let eliminados = 0;


        for (
            const usuario of usuariosActuales
        ) {

            const documento =
                String(
                    usuario?.userId || ""
                ).trim();


            if (!documento) {

                continue;
            }


            if (
                empleadosPorDocumento.has(
                    documento
                )
            ) {

                continue;
            }


            const uid =
                Number(
                    usuario?.uid
                );


            if (
                !Number.isInteger(uid) ||
                uid <= 0
            ) {

                console.warn(
                    "No se puede eliminar usuario con UID inválido:",
                    usuario
                );

                continue;
            }


            console.log(
                `Eliminando usuario obsoleto UID=${uid} USERID=${documento}...`
            );


            await this.zk.deleteUser(
                uid
            );


            eliminados++;
        }


        /*
         * =====================================================
         * 5. AGREGAR / ACTUALIZAR EMPLEADOS
         * =====================================================
         */
        let cargados = 0;

        const errores = [];

        const empleadosCargados = [];


        for (
            const empleado of empleados
        ) {

            const documento =
                String(
                    empleado?.documento || ""
                ).trim();


            if (!documento) {

                errores.push({

                    idempleado:
                        empleado?.idempleado ?? null,

                    documento:
                        null,

                    error:
                        "El empleado no tiene documento."

                });

                continue;
            }


            /*
             * Buscar si ya existe en el K40.
             */
            const usuarioExistente =
                usuariosPorDocumento.get(
                    documento
                );


            try {

                /*
                 * Si existe:
                 *
                 * usamos el UID existente.
                 *
                 * Esto permite actualizar nombre/tarjeta
                 * sin crear otro registro.
                 */
                const uidExistente =
                    usuarioExistente
                        ? Number(
                            usuarioExistente.uid
                        )
                        : null;


                const resultado =
                    await this.cargarEmpleado(
                        empleado,
                        uidExistente
                    );


                if (
                    resultado?.ok
                ) {

                    cargados++;

                    empleadosCargados.push(
                        resultado.empleado
                    );
                }

            } catch (error) {

                const mensaje =
                    error?.err?.message ||
                    error?.message ||
                    String(error);


                console.error(
                    `Error sincronizando empleado ${empleado?.idempleado} / ${documento}:`,
                    mensaje
                );


                errores.push({

                    idempleado:
                        empleado?.idempleado ?? null,

                    documento:
                        documento,

                    error:
                        mensaje

                });
            }
        }


        /*
         * =====================================================
         * 6. RESULTADO
         * =====================================================
         */
        console.log(
            "======================================"
        );

        console.log(
            "SINCRONIZACIÓN FINALIZADA"
        );

        console.log(
            `Eliminados: ${eliminados}`
        );

        console.log(
            `Cargados/actualizados: ${cargados}`
        );

        console.log(
            `Errores: ${errores.length}`
        );

        console.log(
            "======================================"
        );


        return {

            ok:
                errores.length === 0,

            eliminados,

            cargados,

            errores,

            empleados:
                empleadosCargados

        };
    }


    async leerFichadas() {

        const cantidad =
            await this.zk.getAttendanceSize();


        console.log(
            "Cantidad de fichadas en el lector:",
            cantidad
        );


        if (
            Number(cantidad) === 0
        ) {

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