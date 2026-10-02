require("dotenv").config();

const configuracionLectores =
    require("./services/configuracionLectores");

(async () => {

    try {

        const lectores =
            await configuracionLectores.actualizar();

        console.log(
            "======================================"
        );

        console.log(
            "LECTORES RECIBIDOS:"
        );

        console.log(
            JSON.stringify(
                lectores,
                null,
                4
            )
        );

        console.log(
            "======================================"
        );

        process.exit(0);

    } catch (error) {

        console.error(
            "ERROR:"
        );

        console.error(
            error?.message || error
        );

        process.exit(1);
    }

})();