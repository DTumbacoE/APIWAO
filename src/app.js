
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

// Railway utiliza un proxy delante del servidor.
app.set('trust proxy', 1);

// URL exacta del frontend autorizado, sin barra final.
const frontendPermitido = process.env.FRONTEND_URL;


// Configuración de CORS.
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir clientes sin Origin, como aplicaciones móviles.
    // Las rutas web sensibles tienen una validación adicional.
    if (!origin || origin === frontendPermitido) {
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

  credentials: true
};

app.use(cors(corsOptions));

// Leer cookies enviadas por el navegador.
app.use(cookieParser());

// Limitar el tamaño de las solicitudes JSON.
app.use(express.json({
  limit: '100kb'
}));

// Evitar almacenar respuestas de autenticación.
app.use('/api/usuarios/login-web', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Protección adicional contra login CSRF.
app.use('/api/usuarios/login-web', (req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }

  const origen = req.get('Origin');

  if (origen !== frontendPermitido) {
    return res.status(403).json({
      success: false,
      message: 'Origen no autorizado'
    });
  }

  next();
});

// Limitar intentos en endpoints sensibles.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
  }
});

// Cabeceras de seguridad para verificación de correo.
app.use('/api/usuarios/verificar-correo', (req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Rate limiting.
app.use(
  [
    '/api/usuarios/registro',
    '/api/usuarios/login',
    '/api/usuarios/login-web',
    '/api/usuarios/reenviar-verificacion',
    '/api/recuperacion/recuperar-contrasena',
    '/api/recuperacion/verificar-codigo',
    '/api/recuperacion/restablecer-contrasena',
    '/api/perfil/cambiar-contrasena'
  ],
  authLimiter
);

// Ruta principal.
app.get('/', (req, res) => {
  return res.json({
    success: true,
    proyecto: 'WAO API',
    version: '1.0.0'
  });
});

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

// Configuración de cuenta y fotos de perfil.
app.use('/api/perfil', PerfilRoutes);

// Ruta no encontrada.
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA'
  });
});

// Manejo centralizado de errores.
app.use((err, req, res, next) => {
  console.error('Error en API:', err);

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

export default app;
