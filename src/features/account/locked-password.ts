/**
 * Contraseña inservible: ninguna contraseña coincide con ella. Se pone en las filas que se
 * unen a una cuenta global sin ser la de la sesión (pudo registrarlas otra persona con ese
 * número). El dueño verificado entra a ellas por su cuenta, no con la contraseña antigua.
 * Sin imports a propósito: lo usan también las rutas de recuperar y restablecer contraseña.
 */
export const LOCKED_PASSWORD_HASH = '!cuenta-global';
export const isLockedPassword = (hash: string | null | undefined) => hash === LOCKED_PASSWORD_HASH;
