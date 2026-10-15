import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import usuariosRoutes from './Routes/usuario.routes.js';
import negocioRoutes from './Routes/Negocios.routes.js';
import horariosRoutes from './Routes/Horarios.routes.js';
import imagenesRoutes from './Routes/Imagenes.routes.js';
import PlanRoutes from './Routes/Plan.routes.js';

const app = express();
app.set('trust proxy', 1);

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

// Límite general para las rutas de autenticación.
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

// Aplicar el límite únicamente a las operaciones sensibles.
app.use(
  [
    '/api/usuarios/registro',
    '/api/usuarios/login',
    '/api/usuarios/reenviar-verificacion',
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

// RUTAS EXISTENTES
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/negocios', negocioRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/imagenes', imagenesRoutes);
app.use('/api/planes', PlanRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA',
  });
});

export default app;