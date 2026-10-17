
const CORREO_REGEX =
    /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/i;

const NOMBRE_REGEX =
    /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

const TELEFONO_REGEX = /^0[0-9]{9}$/;

const CAMPOS_PERMITIDOS = new Set([
    'nombre',
    'apellido',
    'correo',
    'telefono',
    'direccion',
    'password',
    'id_rol'
]);

const espaciosInvalidos = (valor) =>
    valor !== valor.trim() ||
    /\s{2,}/u.test(valor) ||
    /[\t\n\r]/u.test(valor);

const error = (mensaje) => ({
    valido: false,
    mensaje
});

export function validarRegistro(body) {

    // ========================================================
    // 1. VALIDAR ESTRUCTURA
    // ========================================================

    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body)
    ) {
        return error('Datos de registro inválidos');
    }

    // Rechazar propiedades adicionales.
    const camposRecibidos = Object.keys(body);

    if (
        camposRecibidos.some(
            (campo) => !CAMPOS_PERMITIDOS.has(campo)
        )
    ) {
        return error(
            'La solicitud contiene campos no permitidos'
        );
    }

    const {
        nombre,
        apellido,
        correo,
        telefono,
        direccion,
        password
    } = body;

    // ========================================================
    // 2. VALIDAR ROL
    // ========================================================

    // El registro público solo admite:
    // 2 = Propietario
    // 3 = Turista
    //
    // Nunca permite:
    // 1 = Administrador

    let idRol = 3;

    if (Object.hasOwn(body, 'id_rol')) {
        if (
            body.id_rol !== 2 &&
            body.id_rol !== 3 &&
            body.id_rol !== '2' &&
            body.id_rol !== '3'
        ) {
            return error(
                'El rol seleccionado no es válido'
            );
        }

        idRol = Number(body.id_rol);
    }

    // ========================================================
    // 3. VALIDAR NOMBRE
    // ========================================================

    if (
        typeof nombre !== 'string' ||
        nombre.length < 2 ||
        nombre.length > 60 ||
        espaciosInvalidos(nombre) ||
        !NOMBRE_REGEX.test(nombre)
    ) {
        return error(
            'El nombre debe tener entre 2 y 60 caracteres ' +
            'y contener solamente letras válidas.'
        );
    }

    // ========================================================
    // 4. VALIDAR APELLIDO
    // ========================================================

    if (
        typeof apellido !== 'string' ||
        apellido.length < 2 ||
        apellido.length > 60 ||
        espaciosInvalidos(apellido) ||
        !NOMBRE_REGEX.test(apellido)
    ) {
        return error(
            'El apellido debe tener entre 2 y 60 caracteres ' +
            'y contener solamente letras válidas.'
        );
    }

    // ========================================================
    // 5. VALIDAR CORREO
    // ========================================================

    if (
        typeof correo !== 'string' ||
        correo.length > 150 ||
        espaciosInvalidos(correo) ||
        !CORREO_REGEX.test(correo)
    ) {
        return error(
            'Ingresa un correo Gmail o Hotmail válido, ' +
            'sin espacios.'
        );
    }

    const correoNormalizado = correo.toLowerCase();

    // ========================================================
    // 6. VALIDAR TELÉFONO
    // ========================================================

    if (
        typeof telefono !== 'string' ||
        !TELEFONO_REGEX.test(telefono)
    ) {
        return error(
            'El teléfono debe contener exactamente ' +
            '10 dígitos y comenzar con 0.'
        );
    }

    // ========================================================
    // 7. VALIDAR DIRECCIÓN
    // ========================================================

    if (
        typeof direccion !== 'string' ||
        direccion.length < 1 ||
        direccion.length > 255 ||
        !direccion.trim() ||
        espaciosInvalidos(direccion)
    ) {
        return error(
            'La dirección debe tener entre 1 y 255 ' +
            'caracteres y no contener espacios innecesarios.'
        );
    }

    // ========================================================
    // 8. VALIDAR CONTRASEÑA
    // ========================================================

    if (
        typeof password !== 'string' ||
        password.length < 12 ||
        password.length > 128 ||
        /\s/u.test(password)
    ) {
        return error(
            'La contraseña debe tener entre 12 y 128 ' +
            'caracteres y no contener espacios.'
        );
    }

    // ========================================================
    // 9. DEVOLVER DATOS VALIDADOS
    // ========================================================

    return {
        valido: true,
        mensaje: 'Datos válidos',
        datos: {
            nombre,
            apellido,
            correo: correoNormalizado,
            telefono,
            direccion,
            password,
            idRol
        }
    };
}
