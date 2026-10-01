import { IsNewPassword } from '../../auth/dto/change-password.dto';

export class AcceptInvitationDto {
  /** Même politique que le changement de mot de passe (ChangePasswordDto). */
  @IsNewPassword()
  password!: string;
}
