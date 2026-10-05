require("dotenv").config();

const EnrolamientoZKTeco =
    require("./services/enrolamientoZKTeco");

const IP = "192.168.1.235";
const PUERTO = 4370;

const ID_USUARIO = 1;
const ID_DEDO = 6;

(async () => {

    const enrolamiento =
        new EnrolamientoZKTeco(
            IP,
            PUERTO
        );

    try {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "TEST FINAL - SERVICIO DE ENROLAMIENTO"
        );
        console.log(
            "======================================"
        );
        console.log("");

        await enrolamiento.conectar();

        const resultado =
            await enrolamiento.enrolarHuella(
                ID_USUARIO,
                ID_DEDO
            );

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "RESULTADO FINAL"
        );
        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            "OK:",
            resultado.ok
        );

        console.log(
            "Usuario:",
            resultado.usuario
        );

        console.log(
            "Dedo:",
            resultado.dedo
        );

        console.log(
            "Valid:",
            resultado.valid
        );

        console.log(
            "Tamaño:",
            resultado.size
        );

        console.log(
            "Mark:",
            resultado.mark
        );

        console.log(
            "Template:",
            resultado.template
        );

        console.log("");

        console.log(
            "======================================"
        );
        console.log(
            "PRUEBA FINAL EXITOSA"
        );
        console.log(
            "======================================"
        );

    } catch (error) {

        console.error("");
        console.error(
            "======================================"
        );
        console.error(
            "ERROR EN EL ENROLAMIENTO"
        );
        console.error(
            "======================================"
        );

        console.error(
            error?.message || error
        );

        console.error("");

    } finally {

        try {

            await enrolamiento.desconectar();

        } catch (error) {

            console.error(
                "Error desconectando:",
                error?.message || error
            );
        }
    }

})();