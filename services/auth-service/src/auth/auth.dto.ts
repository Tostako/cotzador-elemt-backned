import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsEmail() @MaxLength(120) email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(6) @MaxLength(100) @Matches(PASSWORD_REGEX, { message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número' }) password: string;
  @IsString() @MaxLength(60) @Matches(SLUG_REGEX, { message: 'El slug de tienda solo puede contener letras minúsculas, números y guiones' }) shop_slug: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(120) email: string;
  @IsString() @MinLength(1) password: string;
  @IsString() @MaxLength(60) @Matches(SLUG_REGEX, { message: 'El slug de tienda solo puede contener letras minúsculas, números y guiones' }) shop_slug: string;
}

export class SelectShopDto {
  @IsString() @MaxLength(60) @Matches(SLUG_REGEX, { message: 'El slug de tienda solo puede contener letras minúsculas, números y guiones' }) shop_slug: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(6) @MaxLength(100) @Matches(PASSWORD_REGEX, { message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número' }) new_password: string;
  @IsString() @MaxLength(60) @Matches(SLUG_REGEX, { message: 'El slug de tienda solo puede contener letras minúsculas, números y guiones' }) shop_slug: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
