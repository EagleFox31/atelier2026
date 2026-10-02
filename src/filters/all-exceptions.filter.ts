import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Erreur interne du serveur';
        let code = 'INTERNAL_ERROR';
        let details: Record<string, unknown> = {};

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse() as any;
            message = typeof res === 'string' ? res : res.message || res.error || message;
            // Un errorCode métier explicite (TRIAL_READ_ONLY, PAID_FEATURE_REQUIRED…) est un
            // contrat d'API : il prime sur le libellé HTTP générique (« Forbidden »).
            code = typeof res === 'string' ? 'HTTP_ERROR' : res.errorCode || res.error || 'HTTP_ERROR';
            if (typeof res === 'object' && res !== null) {
                // Détails métier fournis volontairement par l'exception (subscriptionStatus, feature…).
                const { message: _m, error: _e, statusCode: _s, errorCode: _c, ...rest } = res;
                details = rest;
            }
        }
        // Gérer proprement les erreurs Prisma (au lieu de crasher le front avec un vieux message SQL)
        else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002') {
                status = HttpStatus.CONFLICT;
                const fields = (exception.meta?.target as string[])?.join(', ');
                message = fields
                    ? `Conflit : la valeur du champ "${fields}" est déjà utilisée.`
                    : 'Conflit de données : cette valeur est déjà utilisée (doit être unique).';
                code = 'DB_CONFLICT';
            } else if (exception.code === 'P2025') {
                status = HttpStatus.NOT_FOUND;
                message = 'Enregistrement introuvable.';
                code = 'DB_NOT_FOUND';
            } else if (exception.code === 'P2003') {
                status = HttpStatus.BAD_REQUEST;
                message = 'Référence invalide : l\'identifiant lié n\'existe pas.';
                code = 'DB_FOREIGN_KEY';
            } else if (exception.code === 'P2022') {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                const column = exception.meta?.column as string | undefined;
                message = column
                    ? `Colonne manquante en base de données (${column}).`
                    : 'Schéma base de données incomplet.';
                code = 'DB_SCHEMA_OUTDATED';
            } else {
                status = HttpStatus.BAD_REQUEST;
                message = `Erreur base de données (${exception.code})`;
                code = exception.code;
            }
        }
        // Mauvais types passés à Prisma (UUID malformé, champ requis absent, etc.)
        else if (exception instanceof Prisma.PrismaClientValidationError) {
            status = HttpStatus.BAD_REQUEST;
            message = 'Données invalides envoyées à la base de données.';
            code = 'DB_VALIDATION_ERROR';
            // Le message Prisma complet recopie les arguments de la requête (téléphones,
            // corps de SMS…) : on ne journalise que le motif, sans les valeurs.
            this.logger.warn(prismaValidationReason(exception.message));
        }
        // Timeout ou crash Base de Données
        else if (exception instanceof Prisma.PrismaClientInitializationError) {
            this.logger.error('Base de données injoignable', exception.stack);
            message = 'Le service en charge des données est temporairement injoignable.';
            code = 'DB_INIT_ERROR';
            status = HttpStatus.SERVICE_UNAVAILABLE;
        }
        // Autres exceptions JavaScript
        else if (exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
            message = exception.message; // DEBUG TEMP — voir l'erreur réelle
        }

        // Logger la route qui a planté — sans query string (ex. `?phone=…` de l'historique SMS).
        const route = `[${request.method} ${pathWithoutQuery(request.url)}]`;
        if (status >= 500) {
            this.logger.error(`${route} ${status} - ${Array.isArray(message) ? message.join(', ') : message}`);
        } else {
            this.logger.warn(`${route} ${status} - ${Array.isArray(message) ? message.join(', ') : message}`);
        }

        // Réponse au format prévisible pour le Frontend
        response.status(status).json({
            ...details,
            statusCode: status,
            errorCode: code,
            message: message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}

/** Chemin de la requête sans query string : les paramètres peuvent porter des données personnelles. */
export function pathWithoutQuery(url: unknown): string {
    return typeof url === 'string' ? url.split('?')[0] : String(url);
}

/**
 * Motif d'une `PrismaClientValidationError` sans les valeurs : Prisma termine son
 * message par la cause (« Argument `x` is missing. »…) après avoir recopié l'appel
 * avec ses arguments ; seule cette dernière ligne est conservée, tronquée.
 */
export function prismaValidationReason(message: string): string {
    const lines = message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const reason = lines[lines.length - 1] ?? 'Erreur de validation Prisma';
    return `Validation Prisma : ${reason.length > 200 ? `${reason.slice(0, 200)}…` : reason}`;
}
