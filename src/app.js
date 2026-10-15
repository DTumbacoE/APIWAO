
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import usuariosRoutes from './Routes/usuario.routes.js';
import negocioRoutes from './Routes/Negocios.routes.js';
import horariosRoutes from './Routes/Horarios.routes.js';
import imagenesRoutes from './Routes/Imagenes.routes.js';
import PlanRoutes from './Routes/Plan.routes.js';
import RecuperacionRoutes from './Routes/Recuperacion.routes.js';
import PerfilRoutes from './Routes/Perfil.routes.js';

const app = express();

app.set('trust proxy', 1);

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  },
});

app.use('/api/usuarios/verificar-correo', (req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(
  [
    '/api/usuarios/registro',
    '/api/usuarios/login',
    '/api/usuarios/reenviar-verificacion',
    '/api/recuperacion/recuperar-contrasena',
    '/api/recuperacion/verificar-codigo',
    '/api/recuperacion/restablecer-contrasena',
    '/api/perfil/cambiar-contrasena',
  ],
  authLimiter
);

app.get('/', (req, res) => {
  res.json({
    success: true,
    proyecto: 'WAO API',
    version: '1.0.0',
  });
});

// Usuarios y autenticación
app.use('/api/usuarios', usuariosRoutes);

// Negocios
app.use('/api/negocios', negocioRoutes);

// Horarios
app.use('/api/horarios', horariosRoutes);

// Imágenes
app.use('/api/imagenes', imagenesRoutes);

// Planes
app.use('/api/planes', PlanRoutes);

// Recuperación de contraseña
app.use('/api/recuperacion', RecuperacionRoutes);

// Configuración de cuenta y fotos de perfil
app.use('/api/perfil', PerfilRoutes);

// Ruta no encontrada
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA',
  });
});

export default app;
