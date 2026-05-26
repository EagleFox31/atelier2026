
// ⚠️ Charger .env AVANT tout import NestJS — sinon PrismaService et JwtModule
// ne voient pas DATABASE_URL / JWT_SECRET au moment de leur instanciation.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

let isBootstrapped = false;

async function bootstrap() {
  if (isBootstrapped) return;
  isBootstrapped = true;


  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Sécurité et Performance (Point 2)
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Nécessaire pour l'iframe AI Studio
  }));
  app.use(compression());

  // CORS — restreint à l'origine du frontend en production
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Autoriser les requêtes sans origin (mobile, curl, Swagger)
      if (!origin) return callback(null, true);
      // En dev sans restriction explicite, tout autoriser
      if (!process.env.ALLOWED_ORIGINS) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origine non autorisée — ${origin}`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Validation Globale
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Gestionnaire Centralisé d'Exceptions
  app.useGlobalFilters(new AllExceptionsFilter());

  // Préfixe API
  app.setGlobalPrefix('api');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Atelier-CM API')
    .setDescription('Système de gestion d\'atelier mécanique - Cameroun')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? process.env.API_PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application NestJS démarrée sur le port : ${port}`);
  logger.log(`Documentation Swagger disponible sur : http://localhost:${port}/api/docs`);
}

// Export pour usage par server.ts si nécessaire
export { bootstrap };
