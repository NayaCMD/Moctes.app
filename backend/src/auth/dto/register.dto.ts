import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(10, 128)
  password!: string;
}
