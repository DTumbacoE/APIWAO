
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import usuariosRoutes from './Routes/usuario.routes.js';
import negocioRoutes from './Routes/Negocios.routes.js';
import horariosRoutes from './Routes/Horarios.routes.js';
import imagenesRoutes from './Routes/Imagenes.routes.js';
import PlanRoutes from './Routes/Plan.routes.js';
import RecuperacionRoutes from './Routes/Recuperacion.routes.js';
import PerfilRoutes from './Routes/Perfil.routes.js';

const app = express();

// ============================================================
// 1. CONFIGURACIÓN DE RAILWAY
// ============================================================

// Railway utiliza un proxy delante de Node.js.
// Verificar que este valor corresponda al despliegue real.
app.set('trust proxy', 1);

// Evitar exponer la tecnología del servidor.
app.disable('x-powered-by');

// ============================================================
// 2. CONFIGURACIÓN DEL FRONTEND AUTORIZADO
// ============================================================

const obtenerOrigenFrontend = () => {
  try {
    const url = new URL(process.env.FRONTEND_URL);

    if (url.protocol !== 'https:') {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
};

const frontendPermitido = obtenerOrigenFrontend();

if (!frontendPermitido) {
  console.warn(
    'ADVERTENCIA: FRONTEND_URL no está configurada ' +
    'correctamente. El acceso web estará restringido.'
  );
}

// ============================================================
// 3. CONFIGURACIÓN CORS
// ============================================================

const corsOptions = {
  origin: (origin, callback) => {
    // Los clientes sin Origin, como algunos clientes móviles
    // o herramientas HTTP, pueden realizar solicitudes.
    // La autenticación sigue siendo obligatoria donde aplique.
    if (!origin) {
      return callback(null, true);
    }

    if (frontendPermitido && origin === frontendPermitido) {
      return callback(null, true);
    }

    return callback(
      new Error('Origen no permitido por CORS')
    );
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token'
  ],

  credentials: true,

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// ============================================================
// 4. PARSEO DE COOKIES Y JSON
// ============================================================

app.use(cookieParser());

app.use(express.json({
  limit: '100kb'
}));

// ============================================================
// 5. PROTECCIÓN DEL LOGIN WEB
// ============================================================

// El login web establece una cookie HttpOnly.
// Por eso se comprueba el Origin antes de permitir el login.

app.use('/api/usuarios/login-web', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return next();
  }

  const origen = req.get('Origin');

  if (!frontendPermitido || origen !== frontendPermitido) {
    return res.status(403).json({
      success: false,
      message: 'Origen no autorizado'
    });
  }

  next();
});

// ============================================================
// 6. LIMITADOR DE INTENTOS DE LOGIN
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Máximo de 10 solicitudes fallidas por ventana.
  limit: 10,

  // Las respuestas exitosas no consumen el límite.
  skipSuccessfulRequests: true,

  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Demasiados intentos de inicio de sesión. ' +
      'Inténtalo nuevamente más tarde.'
  }
});

// ============================================================
// 7. LIMITADOR PARA OTRAS OPERACIONES SENSIBLES
// ============================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Demasiadas solicitudes. ' +
      'Inténtalo nuevamente más tarde.'
  }
});

// Aplicar límite específico a ambos tipos de login.
app.use(
  [
    '/api/usuarios/login',
    '/api/usuarios/login-web'
  ],
  loginLimiter
);

// Aplicar límite a otras operaciones sensibles.
app.use(
  [
    '/api/usuarios/registro',
    '/api/usuarios/reenviar-verificacion',
    '/api/recuperacion/recuperar-contrasena',
    '/api/recuperacion/verificar-codigo',
    '/api/recuperacion/restablecer-contrasena',
    '/api/perfil/cambiar-contrasena'
  ],
  authLimiter
);

// ============================================================
// 8. CABECERAS DE SEGURIDAD
// ============================================================

// Evitar almacenar respuestas de autenticación.
app.use(
  [
    '/api/usuarios/login',
    '/api/usuarios/login-web',
    '/api/usuarios/logout-web',
    '/api/usuarios/validar-token',
    '/api/usuarios/perfil'
  ],
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }
);

// Cabeceras para el enlace de verificación de correo.
app.use('/api/usuarios/verificar-correo', (req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ============================================================
// 9. RUTA PRINCIPAL
// ============================================================

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    proyecto: 'WAO API',
    version: '1.0.0'
  });
});

// ============================================================
// 10. RUTAS DE LA API
// ============================================================

// Usuarios y autenticación.
app.use('/api/usuarios', usuariosRoutes);

// Negocios.
app.use('/api/negocios', negocioRoutes);

// Horarios.
app.use('/api/horarios', horariosRoutes);

// Imágenes.
app.use('/api/imagenes', imagenesRoutes);

// Planes.
app.use('/api/planes', PlanRoutes);

// Recuperación de contraseña.
app.use('/api/recuperacion', RecuperacionRoutes);

// Perfil y configuración de cuenta.
app.use('/api/perfil', PerfilRoutes);

// ============================================================
// 11. RUTA NO ENCONTRADA
// ============================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA'
  });
});

// ============================================================
// 12. MANEJO CENTRALIZADO DE ERRORES
// ============================================================

app.use((err, req, res, next) => {
  console.error('Error en API:', err);

  // Solicitud JSON malformada.
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      success: false,
      message: 'El formato JSON enviado es inválido'
    });
  }

  // Solicitud demasiado grande.
  if (err.status === 413) {
    return res.status(413).json({
      success: false,
      message: 'El contenido enviado supera el tamaño permitido'
    });
  }

  // Origen no permitido por CORS.
  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origen no autorizado'
    });
  }

  // Cualquier otro error.
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

export default app;
