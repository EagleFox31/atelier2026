import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Politique minimale côté serveur (le front affiche en plus un indicateur de robustesse). */
export const NEW_PASSWORD_MIN_LENGTH = 10;

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(NEW_PASSWORD_MIN_LENGTH, {
    message: `Le nouveau mot de passe doit contenir au moins ${NEW_PASSWORD_MIN_LENGTH} caractères.`,
  })
  @MaxLength(128)
  @Matches(/[A-Za-zÀ-ÿ]/, { message: 'Le nouveau mot de passe doit contenir au moins une lettre.' })
  @Matches(/\d/, { message: 'Le nouveau mot de passe doit contenir au moins un chiffre.' })
  newPassword!: string;
}
