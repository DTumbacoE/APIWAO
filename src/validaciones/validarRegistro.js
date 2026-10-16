
const CORREO_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com)$/;

const NOMBRE_REGEX =
  /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

const TELEFONO_REGEX = /^0[0-9]{9}$/;

const espaciosInvalidos = (valor) =>
  valor !== valor.trim() ||
  /\s{2,}/u.test(valor) ||
  /[\t\n\r]/u.test(valor);

export function validarRegistro(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valido: false,
      mensaje: 'Datos de registro inválidos'
    };
  }

  const {
    nombre,
    apellido,
    correo,
    telefono,
    direccion,
    password
  } = body;

  const idRol = body.id_rol === undefined
    ? 3
    : Number(body.id_rol);

  if (
    typeof nombre !== 'string' ||
    nombre.length < 2 ||
    nombre.length > 60 ||
    espaciosInvalidos(nombre) ||
    !NOMBRE_REGEX.test(nombre)
  ) {
    return {
      valido: false,
      mensaje:
        'El nombre debe tener entre 2 y 60 caracteres y contener solamente letras válidas.'
    };
  }

  if (
    typeof apellido !== 'string' ||
    apellido.length < 2 ||
    apellido.length > 60 ||
    espaciosInvalidos(apellido) ||
    !NOMBRE_REGEX.test(apellido)
  ) {
    return {
      valido: false,
      mensaje:
        'El apellido debe tener entre 2 y 60 caracteres y contener solamente letras válidas.'
    };
  }

  if (
    typeof correo !== 'string' ||
    correo.length > 150 ||
    /\s/u.test(correo) ||
    !CORREO_REGEX.test(correo.toLowerCase())
  ) {
    return {
      valido: false,
      mensaje:
        'Ingresa un correo Gmail o Hotmail válido, sin espacios.'
    };
  }

  if (
    typeof telefono !== 'string' ||
    !TELEFONO_REGEX.test(telefono)
  ) {
    return {
      valido: false,
      mensaje:
        'El teléfono debe contener exactamente 10 dígitos y comenzar con 0.'
    };
  }

  if (
    typeof direccion !== 'string' ||
    direccion.length < 1 ||
    direccion.length > 255 ||
    !direccion.trim() ||
    espaciosInvalidos(direccion)
  ) {
    return {
      valido: false,
      mensaje:
        'La dirección debe tener entre 1 y 255 caracteres y no contener espacios innecesarios.'
    };
  }

  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128 ||
    /\s/u.test(password)
  ) {
    return {
      valido: false,
      mensaje:
        'La contraseña debe tener entre 12 y 128 caracteres y no contener espacios.'
    };
  }

  if (
    !Number.isInteger(idRol) ||
    ![2, 3].includes(idRol)
  ) {
    return {
      valido: false,
      mensaje: 'El rol seleccionado no es válido.'
    };
  }

  return {
    valido: true,
    mensaje: 'Datos válidos',
    datos: {
      nombre,
      apellido,
      correo: correo.toLowerCase(),
      telefono,
      direccion,
      password,
      idRol
    }
  };
}
