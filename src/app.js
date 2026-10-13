import express from 'express';
import cors from 'cors';

import usuariosRoutes from './Routes/usuario.routes.js';
import negocioRoutes from './Routes/Negocios.routes.js';
import horariosRoutes from './Routes/Horarios.routes.js';
import imagenesRoutes from './Routes/Imagenes.routes.js';
import PlanRoutes from './Routes/Plan.routes.js';

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    proyecto: 'WAO API',
    version: '1.0.0'
  });
});

// RUTAS
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/negocios', negocioRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/imagenes', imagenesRoutes);
app.use('/api/planes', PlanRoutes);
// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'PÁGINA NO ENCONTRADA'
  });
});

export default app;